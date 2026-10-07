class ApplicationMailer < ActionMailer::Base
  # Who emails appear to come from. Set MAIL_FROM on the server; it should
  # be an address at a domain the mail service is allowed to send for, or
  # the email lands in spam.
  default from: -> { ENV.fetch("MAIL_FROM", "The Comfy Zone <no-reply@comfyzone.shop>") }
  layout "mailer"

  # Is a mail server set up? Production switches deliveries off when there
  # are no SMTP settings (config/environments/production.rb), and pages that
  # depend on email check this before promising to send anything.
  def self.sending?
    ActionMailer::Base.perform_deliveries
  end
end
