# Settings > Sales channels: where sales come from.
class Settings::SalesChannelsController < InertiaController
  require_permission "settings.manage"
  before_action :set_channel, only: %i[ edit update destroy move ]

  # GET /settings/channels
  def index
    counts = Order.group(:sales_channel_id).count # one query for all channels

    render inertia: "Settings/SalesChannels/Index", props: {
      channels: SalesChannel.ordered.map { |channel|
        { id: channel.id, name: channel.name, kind: channel.kind, active: channel.active,
          orders_count: counts.fetch(channel.id, 0) }
      }
    }
  end

  # GET /settings/channels/new
  def new
    render inertia: "Settings/SalesChannels/Form", props: { channel: nil }
  end

  # POST /settings/channels
  def create
    channel = SalesChannel.new(channel_params)

    if channel.save
      redirect_to settings_sales_channels_path, notice: "Added #{channel.name}."
    else
      redirect_to new_settings_sales_channel_path, inertia: { errors: channel.errors }
    end
  end

  # GET /settings/channels/:id/edit
  def edit
    render inertia: "Settings/SalesChannels/Form", props: {
      channel: { id: @channel.id, name: @channel.name, kind: @channel.kind, active: @channel.active,
                 orders_count: @channel.orders.count }
    }
  end

  # PATCH /settings/channels/:id
  def update
    if @channel.update(channel_params)
      redirect_to settings_sales_channels_path, notice: "Saved #{@channel.name}."
    else
      redirect_to edit_settings_sales_channel_path(@channel), inertia: { errors: @channel.errors }
    end
  end

  # DELETE /settings/channels/:id
  def destroy
    @channel.destroy!
    redirect_to settings_sales_channels_path, notice: "Deleted #{@channel.name}. Its orders were kept.", status: :see_other
  end

  # PATCH /settings/channels/:id/move?direction=up
  def move
    @channel.move(params[:direction] == "up" ? :up : :down)
    redirect_to settings_sales_channels_path
  end

  private
    def set_channel
      @channel = SalesChannel.find(params.expect(:id))
    end

    def channel_params
      params.expect(sales_channel: [ :name, :kind, :active ])
    end
end
