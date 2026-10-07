# bin/rails push:keys
#
# Prints a fresh pair of VAPID keys for push notifications. Run it ONCE and
# paste the two lines into deploy/.env on the server (and into your own
# shell or .env for development). Making a new pair later disconnects every
# phone that had notifications on, so keep them.
namespace :push do
  desc "Make the key pair that push notifications are signed with"
  task keys: :environment do
    key = WebPush.generate_key

    puts "VAPID_PUBLIC_KEY=#{key.public_key}"
    puts "VAPID_PRIVATE_KEY=#{key.private_key}"
  end
end
