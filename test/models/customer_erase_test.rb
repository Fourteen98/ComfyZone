require "test_helper"

class CustomerEraseTest < ActiveSupport::TestCase
  test "erasing keeps the sale but not who made it" do
    black = variants(:dress_m_black)
    StockLedger.record!(variant: black, quantity: 2, reason: "purchase", total_cost_pesewas: 12_000)
    customer = Customer.create!(name: "Esi Owusu", phone: "0241112233", location: "Near the mall", note: "Likes red")
    taker = OrderTaker.new(customer: customer, user: users(:one), lines: [ { variant_id: black.id, quantity: 1 } ])
    taker.save || flunk
    taker.order.update!(delivery_address: "House 4, Osu", payment_claim: "123456789")
    chat = WhatsappConversation.for("+233241112233", name: "Esi")
    chat.messages.create!(direction: "in", kind: "text", body: "hi", payload: {}, status: "received")
    StockRequest.ask!(customer: customer, variant: black, source: "sale", user: users(:one))

    customer.erase_personal_data!

    customer.reload
    assert customer.erased?
    assert_equal [ "Deleted customer", nil, nil, nil ], [ customer.name, customer.phone, customer.location, customer.note ]
    assert_not WhatsappConversation.exists?(chat.id)
    assert_equal 0, WhatsappMessage.count
    assert_equal 0, customer.stock_requests.count
    order = taker.order.reload
    assert_equal [ 12_000, nil, nil ], [ order.total_pesewas, order.delivery_address, order.payment_claim ] # the sale stays
    assert_equal customer, order.customer
  end
end
