# Passkeys are tied to the exact address of the site: a passkey made on
# http://localhost:3000 only works there. That is what makes them immune to
# fake login pages.
#
# In production, set APP_ORIGIN to the real address, e.g.
#   APP_ORIGIN=https://app.thecomfyzone.com
# Passkeys require HTTPS everywhere except localhost.
WebAuthn.configure do |config|
  config.allowed_origins = [ ENV.fetch("APP_ORIGIN", "http://localhost:3000") ]

  # The name the phone shows when asking for Face ID or a fingerprint.
  config.rp_name = "The Comfy Zone"
end
