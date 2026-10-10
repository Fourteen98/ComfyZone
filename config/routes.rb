Rails.application.routes.draw do
  # Vite's dev server runs on "localhost". If you open 127.0.0.1 instead,
  # bounce to localhost so Rails and Vite agree on the host. This must stay
  # first: routes are matched top to bottom, and the first match wins.
  constraints(host: "127.0.0.1") do
    get "(*path)", to: redirect { |params, req| "#{req.protocol}localhost:#{req.port}/#{params[:path]}" }
  end

  # ---------- The back office ----------
  # Everything staff use lives under /admin. `scope path:` only changes the
  # URLs: controllers and helper names stay as they were (orders_path is now
  # "/admin/orders"), so nothing else in Rails had to change.
  scope path: "admin" do
    # The home page. "dashboard#show" means DashboardController, action `show`.
    root "dashboard#show", as: :admin_root
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
      # Notifications, one row per device (see app/models/push.rb).
      resources :push_subscriptions, only: %i[ create update destroy ] do
        post :test, on: :member
      end
    end

    # Products. `member` routes act on one product: /products/:id/archive
    resources :products, except: :destroy do
      member do
        patch :archive
        patch :restore
        patch :listing # show it on the public shop, or take it off
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
      # "What to buy next" (RestockAdvisor).
      resource :advice, only: :show, controller: "advice", as: :stock_advice
    end

    resources :stock, only: %i[ index show ], controller: "stock" do
      resources :adjustments, only: :create, module: :stock
      # What one cost, for stock that never came through a purchase.
      resource :cost, only: :update, module: :stock
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
        resource :swap, only: :create               # POST  /orders/:order_id/swap   another size instead
        resource :take_back, only: :create          # POST  /orders/:order_id/take_back  money back instead
      end
    end
    # The waiting list (StockRequest). URLs say /admin/waiting.
    resources :waiting, controller: "waiting_list", as: :waiting_list, only: %i[ index create destroy ] do
      patch :told, on: :member
    end
    resources :customers, except: :destroy do
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
  end

  # ---------- The shop (public, no login) ----------
  # `module: :shop` finds the controllers in app/controllers/shop/;
  # `as: :shop` prefixes the helper names (shop_cart_path), so they can't
  # clash with the back office's.
  root "shop/products#index"
  scope module: :shop, as: :shop do
    get "shop/:id", to: "products#show", as: :product      # /shop/12-ankara-wrap-dress
    resource :cart, only: :show, controller: "cart" do
      # One line per variant, so the variant's id is the line's id.
      post "items", action: :add
      patch "items/:variant_id", action: :change, as: :item
      delete "items/:variant_id", action: :remove
    end
    resource :checkout, only: %i[ show create ], controller: "checkout"
    get "order/:token", to: "orders#show", as: :order      # the shopper's own link
    post "notify", to: "waiting#create", as: :notify       # "tell me when it's back"
  end

  # Old back-office addresses, from before it moved under /admin: saved
  # bookmarks, the installed phone app's shortcuts, links in old
  # notifications. Send them on rather than show a 404.
  #   /orders/12  ->  /admin/orders/12
  get ":section(/*rest)", to: redirect { |params, request|
    query = request.query_string.presence
    [ "/admin/#{params[:section]}", params[:rest] ].compact.join("/") + (query ? "?#{query}" : "")
  }, constraints: { section: /settings|products|orders|live|stock|purchases|suppliers|expenses|account|session|reports|dashboard|customers|passwords/ }

  # Health check for uptime monitors: returns 200 if the app boots.
  get "up" => "rails/health#show", as: :rails_health_check

  # The two files that make the site installable as a phone app. Rails ships
  # the controller (Rails::PwaController); the files are in app/views/pwa.
  # They are public on purpose: the phone fetches them before anyone logs in.
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
end
