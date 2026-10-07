Rails.application.routes.draw do
  # Vite's dev server runs on "localhost". If you open 127.0.0.1 instead,
  # bounce to localhost so Rails and Vite agree on the host. This must stay
  # first: routes are matched top to bottom, and the first match wins.
  constraints(host: "127.0.0.1") do
    get "(*path)", to: redirect { |params, req| "#{req.protocol}localhost:#{req.port}/#{params[:path]}" }
  end

  # The home page. "dashboard#show" means DashboardController, action `show`.
  root "dashboard#show"
  # The Customise page. A singular resource (each person has one dashboard),
  # pointed at the same controller as the home page.
  resource :dashboard, only: %i[ edit update ], controller: "dashboard"

  resources :expenses, except: :show

  resource :reports, only: :show do
    # `constraints` limits what :kind may be; anything else is a 404.
    get "export/:kind", action: :export, as: :export, constraints: { kind: /orders|payments/ }
  end

  # Login / logout. `resource` is singular on purpose: a browser only ever has
  # ONE session, so the URLs have no :id (GET /session/new, POST /session,
  # DELETE /session).
  resource :session, only: %i[ new create destroy ]

  # Logging in with a passkey. Two requests: ask for a challenge, then send
  # back the device's signed answer.
  #   POST /session/passkey/challenge  -> Sessions::PasskeysController#challenge
  #   POST /session/passkey            -> Sessions::PasskeysController#create
  scope "session", module: "sessions", as: "session" do
    resource :passkey, only: :create do
      post :challenge
    end
  end

  # "My account": each person manages their own passkeys here.
  resource :account, only: :show
  namespace :account do
    resources :passkeys, only: %i[ create destroy ] do
      post :challenge, on: :collection
    end
  end

  # Products. `member` routes act on one product: /products/:id/archive
  resources :products, except: :destroy do
    member do
      patch :archive
      patch :restore
    end
    # PATCH /products/:product_id/variant_prices -> Products::VariantPricesController#update
    resource :variant_prices, only: :update, module: :products
    # POST   /products/:product_id/photos        upload one or more
    # DELETE /products/:product_id/photos/:id    remove one
    # PATCH  /products/:product_id/photos/order  reorder (first = cover)
    resources :photos, only: %i[ create destroy ], module: :products do
      patch :order, on: :collection
    end
  end

  # Restocks. `receive` is the moment goods arrive and stock goes up.
  resources :purchases do
    patch :receive, on: :member
  end
  resources :suppliers, except: :destroy

  # Stock on hand. /stock/:id is one variant's history; adjustments are
  # corrections made by hand.
  # The stock take. Declared BEFORE `resources :stock`, or "/stock/count"
  # would be read as "/stock/:id" with an id of "count". Routes are tried
  # from the top, and the first match wins.
  scope "stock", module: :stock do
    resource :count, only: %i[ new create ], path: "count", path_names: { new: "" }, as: :stock_count
  end

  resources :stock, only: %i[ index show ], controller: "stock" do
    resources :adjustments, only: :create, module: :stock
  end

  # Lives. The URLs say /live, the controller is LiveSessionsController.
  resources :live, controller: "live_sessions", except: :new do
    patch :finish, on: :member
  end

  # Orders. Claims from the live screen and one-off sales both POST /orders.
  resources :orders, except: :destroy do
    patch :cancel, on: :member
    # `module: :orders` looks for these controllers in app/controllers/orders/.
    scope module: :orders do
      resources :items, only: :destroy
      resources :payments, only: :create          # POST  /orders/:order_id/payments
      resources :refunds, only: :create           # POST  /orders/:order_id/refunds
      # Singular `resource`: one per order, so no id in the URL.
      resource :stage, only: :update              # PATCH /orders/:order_id/stage
      resource :delivery, only: :update           # PATCH /orders/:order_id/delivery
      resource :return, only: :create             # POST  /orders/:order_id/return
    end
  end
  resources :customers, except: %i[ show destroy ] do
    post :merge, on: :member # /customers/:id/merge  fold a duplicate into this one
  end

  # Settings. `namespace` puts these under /settings/... and looks for the
  # controllers in app/controllers/settings/.
  resource :settings, only: :show, controller: "settings"
  namespace :settings do
    resources :users, except: %i[ show destroy ] # people are switched off, never deleted
    resources :roles, except: :show
    # `path:` changes the URL (/settings/options) without changing the
    # controller or helper names (settings_option_presets_path).
    resources :option_presets, path: "options", except: :show
    resources :categories, except: :show do
      patch :move, on: :member # /settings/categories/:id/move
    end
    resources :sales_channels, path: "channels", except: :show do
      patch :move, on: :member # /settings/channels/:id/move
    end
    resources :delivery_areas, path: "areas", except: :show do
      post :merge, on: :member # /settings/areas/:id/merge
    end
    resources :payment_methods, path: "payments", except: :show do
      patch :move, on: :member
    end
  end

  # Forgot-password flow (generated by `rails generate authentication`).
  resources :passwords, param: :token

  # Health check for uptime monitors: returns 200 if the app boots.
  get "up" => "rails/health#show", as: :rails_health_check

  # The two files that make the site installable as a phone app. Rails ships
  # the controller (Rails::PwaController); the files are in app/views/pwa.
  # They are public on purpose: the phone fetches them before anyone logs in.
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
end
