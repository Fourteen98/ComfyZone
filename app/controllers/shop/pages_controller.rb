# Plain public pages: the privacy policy (Meta asks for its address before
# the WhatsApp app can go live; customers can read it from the shop footer).
class Shop::PagesController < Shop::BaseController
  # The date the policy last changed. Update it whenever the text changes.
  PRIVACY_UPDATED = Date.new(2026, 10, 14)

  # GET /privacy
  def privacy
    render inertia: "Shop/Privacy", props: {
      updated: PRIVACY_UPDATED.strftime("%-d %B %Y"),
      contact_email: "hello@comfyzone.shop"
    }
  end

  # GET /data-deletion   how to have your data deleted (Meta asks for the
  # address of these instructions in the app's settings)
  def data_deletion
    render inertia: "Shop/DataDeletion", props: { contact_email: "hello@comfyzone.shop" }
  end
end
