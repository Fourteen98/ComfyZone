require "test_helper"

class PasswordsControllerTest < ActionDispatch::IntegrationTest
  setup { @user = users(:one) }

  SENT = "If that email has an account, a reset link is on its way. It works for 15 minutes."

  test "the forgot page offers the form when mail can be sent" do
    get new_password_path
    assert_inertia_component "Passwords/New"
    assert_equal true, inertia.props[:sending]
  end

  test "with no mail server it says so instead of pretending" do
    was = ActionMailer::Base.perform_deliveries
    ActionMailer::Base.perform_deliveries = false

    get new_password_path
    assert_equal false, inertia.props[:sending]
  ensure
    ActionMailer::Base.perform_deliveries = was
  end

  test "asking emails a link, whatever the capitals in the address" do
    post passwords_path, params: { email_address: " #{@user.email_address.upcase} " }
    assert_enqueued_email_with PasswordsMailer, :reset, args: [ @user ]
    assert_redirected_to new_session_path

    follow_redirect!
    assert_inertia_flash notice: SENT
  end

  test "an unknown email gets the same answer and no mail" do
    post passwords_path, params: { email_address: "missing-user@example.com" }
    assert_enqueued_emails 0
    assert_redirected_to new_session_path

    follow_redirect!
    assert_inertia_flash notice: SENT
  end

  test "someone whose access is switched off gets no link" do
    @user.update_columns(active: false)
    post passwords_path, params: { email_address: @user.email_address }
    assert_enqueued_emails 0
  end

  test "the email greets them and carries a working link" do
    mail = PasswordsMailer.reset(@user)

    assert_equal [ @user.email_address ], mail.to
    assert_equal "Choose a new password for The Comfy Zone", mail.subject
    assert_includes mail.html_part.body.to_s, "Hello #{@user.name}"
    link = mail.text_part.body.to_s[%r{http\S+/passwords/\S+/edit}]
    assert link, "the plain text version has the link too"

    get URI(link).path
    assert_inertia_component "Passwords/Edit"
  end

  test "the link opens the new password page" do
    token = @user.password_reset_token
    get edit_password_path(token)
    assert_inertia_component "Passwords/Edit"
    assert_equal token, inertia.props[:token]
  end

  test "a bad or expired link goes back to asking" do
    get edit_password_path("invalid token")
    assert_redirected_to new_password_path

    follow_redirect!
    assert_match "expired or was already used", flash[:alert] || inertia.props[:flash][:alert]
  end

  test "choosing a password changes it, logs every device out, and kills the link" do
    token = @user.password_reset_token
    @user.sessions.create!

    assert_changes -> { @user.reload.password_digest } do
      put password_path(token), params: { password: "new-password", password_confirmation: "new-password" }
      assert_redirected_to new_session_path
    end
    assert_equal 0, @user.sessions.count

    get edit_password_path(token)
    assert_redirected_to new_password_path, "the same link can't be used twice"
  end

  test "a password that is too short, or doesn't match, is refused" do
    token = @user.password_reset_token

    assert_no_changes -> { @user.reload.password_digest } do
      put password_path(token), params: { password: "short", password_confirmation: "short" }
      assert_redirected_to edit_password_path(token)
      put password_path(token), params: { password: "no-match-1", password_confirmation: "no-match-2" }
      assert_redirected_to edit_password_path(token)
    end
  end
end
