ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require_relative "test_helpers/session_test_helper"
require_relative "test_helpers/passkey_test_helper"

# Adds assert_inertia_component, assert_inertia_props, etc.
require "inertia_rails/minitest"

# Build the React and CSS bundle once, now, before the tests are split
# across several processes.
#
# Pages rendered in tests need the built files. Vite would otherwise build
# them on demand the first time a test asks, and with tests running in
# parallel, several processes would start building at the same moment and
# trip over each other. That showed up as one random failure ("can't find
# entrypoints/application.css") in roughly one run in six, and only right
# after a frontend file had changed. Building here, once, removes the race.
# When nothing has changed this is a quick no-op.
ViteRuby.commands.build

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...
  end
end

module ActionDispatch
  class IntegrationTest
    # After `get root_path`: the number on one dashboard tile, or nil if that
    # tile isn't on this person's dashboard.
    def dashboard_tile(key)
      inertia.props[:tiles].find { |tile| tile[:key] == key.to_s }&.fetch(:value)
    end

    # The contents of one dashboard panel, or nil if it isn't shown.
    def dashboard_panel(key)
      inertia.props[:panels].find { |panel| panel[:key] == key.to_s }&.fetch(:data)
    end
  end
end

# Uploaded test photos land in tmp/storage. Clear out the previous run's
# files before any test starts.
FileUtils.rm_rf(Rails.root.join("tmp/storage"))
