# Logging shoppers in on the website. The same idea as the staff login
# (Authentication), kept entirely separate: its own table (shop_sessions),
# its own cookie (shop_session_id), and Current.shop_account instead of
# Current.user. A shopper's login never opens the back office.
#
# "Don't make them log in every time": the cookie lasts a year and is
# renewed (at most once a day) whenever they come back, so someone who
# shops now and then stays logged in on their phone.
module ShopAuthentication
  extend ActiveSupport::Concern

  COOKIE = :shop_session_id

  included do
    before_action :resume_shop_session
  end

  private
    def resume_shop_session
      Current.shop_session ||= find_shop_session
    end

    def find_shop_session
      id = cookies.signed[COOKIE] or return
      found = ShopSession.includes(:shop_account).find_by(id: id)
      return expire_shop_session(nil) unless found
      return expire_shop_session(found) if found.last_seen_at && found.last_seen_at < ShopSession::LASTS.ago

      # Seen again: push the expiry a year on (once a day is enough).
      if found.last_seen_at.nil? || found.last_seen_at < 1.day.ago
        found.update_columns(last_seen_at: Time.current)
        set_shop_cookie(found)
      end
      found
    end

    def expire_shop_session(found)
      found&.destroy
      cookies.delete(COOKIE)
      nil
    end

    def require_shop_account
      return if Current.shop_account

      session[:shop_return_to] = request.fullpath if request.request_method.in?(%w[ GET HEAD ]) # a page, not a form post
      redirect_to shop_login_path, notice: "Log in to see your account."
    end

    def start_shop_session_for(account)
      # A fresh session id on login, so an id someone planted before can't
      # become a logged-in one (session fixation).
      reset_session_keeping_cart
      shop_session = account.sessions.create!(user_agent: request.user_agent.to_s.first(250), ip_address: request.remote_ip,
                                              last_seen_at: Time.current)
      account.update_columns(last_login_at: Time.current)
      Current.shop_session = shop_session
      set_shop_cookie(shop_session)
    end

    def end_shop_session
      Current.shop_session&.destroy
      Current.shop_session = nil
      cookies.delete(COOKIE)
    end

    def set_shop_cookie(shop_session)
      cookies.signed[COOKIE] = { value: shop_session.id, expires: ShopSession::LASTS.from_now, httponly: true, same_site: :lax,
                                 secure: Rails.env.production? }
    end

    # The bag lives in the Rails session; logging in shouldn't empty it.
    def reset_session_keeping_cart
      kept = session.to_hash.slice("cart", "shop_return_to")
      reset_session
      kept.each { |key, value| session[key] = value }
    end

    # "?back=/checkout": where to go after logging in. Only a path on this
    # site ("/..." but not "//other.site"), never another website.
    def remember_back
      back = params[:back].to_s
      session[:shop_return_to] = back if back.start_with?("/") && !back.start_with?("//") && !back.include?("\\")
    end

    def after_shop_login_path
      session.delete(:shop_return_to) || shop_account_path
    end
end
