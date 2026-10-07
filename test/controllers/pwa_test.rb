require "test_helper"

# The files a phone needs to install the app. Fetched before anyone logs in.
class PwaTest < ActionDispatch::IntegrationTest
  test "the manifest is public and names the app and its icons" do
    get "/manifest.json"

    assert_response :success
    manifest = JSON.parse(response.body)
    assert_equal [ "The Comfy Zone", "standalone", "/" ], manifest.values_at("name", "display", "start_url")
    manifest["icons"].each { |icon| assert Rails.public_path.join(icon["src"].delete_prefix("/")).exist?, "#{icon['src']} is missing" }
    assert manifest["icons"].any? { |icon| icon["purpose"] == "maskable" }
  end

  test "the service worker is public, and the page it falls back to exists" do
    get "/service-worker.js"

    assert_response :success
    assert_includes response.body, "/offline.html"
    assert Rails.public_path.join("offline.html").exist?
  end

  test "every page links the manifest" do
    get new_session_path

    assert_select 'link[rel="manifest"][href="/manifest.json"]'
    assert_select 'meta[name="theme-color"]'
  end
end
