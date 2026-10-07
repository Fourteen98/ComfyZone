# See what the email looks like without sending it:
# http://localhost:3000/rails/mailers/passwords_mailer/reset
class PasswordsMailerPreview < ActionMailer::Preview
  def reset
    PasswordsMailer.reset(User.take)
  end
end
