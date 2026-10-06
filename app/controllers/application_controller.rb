class ApplicationController < ActionController::Base
  include Authentication # who are you?   (login)
  include Authorization  # may you do it? (permissions)

  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern
end
