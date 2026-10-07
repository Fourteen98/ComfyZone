# A mailer is like a controller whose "page" is an email: each method sets
# up instance variables, and the matching views in
# app/views/passwords_mailer/ (one HTML, one plain text) become the body.
class PasswordsMailer < ApplicationMailer
  def reset(user)
    @user = user
    mail subject: "Choose a new password for The Comfy Zone", to: user.email_address
  end
end
