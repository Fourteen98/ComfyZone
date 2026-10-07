# Settings > Locations: the places within each region, and the usual delivery fee.
class Settings::DeliveryAreasController < InertiaController
  require_permission "settings.manage"
  before_action :set_area, only: %i[ edit update destroy merge ]

  # GET /settings/areas
  def index
    counts = Order.group(:delivery_area_id).count # one query for all areas

    render inertia: "Settings/DeliveryAreas/Index", props: {
      areas: DeliveryArea.ordered.map { |area|
        { id: area.id, name: area.name, group: area.group_name, fee: area.fee, fee_pesewas: area.fee_pesewas, active: area.active,
          orders_count: counts.fetch(area.id, 0) }
      }
    }
  end

  # GET /settings/areas/new
  def new
    render inertia: "Settings/DeliveryAreas/Form", props: { area: nil, countries: Country::ALL, home: Country::HOME, regions: Region::ALL }
  end

  # POST /settings/areas
  def create
    area = DeliveryArea.new(area_params)

    if area.save
      redirect_to settings_delivery_areas_path, notice: "Added #{area.name}."
    else
      redirect_to new_settings_delivery_area_path, inertia: { errors: area.errors }
    end
  end

  # GET /settings/areas/:id/edit
  def edit
    render inertia: "Settings/DeliveryAreas/Form", props: {
      area: { id: @area.id, name: @area.name, country: @area.country || Country::HOME, region: @area.region.to_s, fee: @area.fee, active: @area.active,
                 orders_count: @area.orders.count },
      countries: Country::ALL,
      home: Country::HOME,
      regions: Region::ALL,
      # Other places, for folding a misspelt twin into this one.
      others: DeliveryArea.where.not(id: @area.id).ordered.map { |area|
        { value: area.id, label: [ area.name, area.group_name ].compact.join(", ") }
      }
    }
  end

  # POST /settings/areas/:id/merge   { other_id: 9 }
  def merge
    other = DeliveryArea.find(params.expect(:other_id))
    name = other.name
    @area.absorb!(other)
    redirect_to edit_settings_delivery_area_path(@area), notice: "Merged #{name} into #{@area.name}."
  rescue ArgumentError => problem
    redirect_to edit_settings_delivery_area_path(@area), alert: problem.message
  end

  # PATCH /settings/areas/:id
  def update
    if @area.update(area_params)
      redirect_to settings_delivery_areas_path, notice: "Saved #{@area.name}."
    else
      redirect_to edit_settings_delivery_area_path(@area), inertia: { errors: @area.errors }
    end
  end

  # DELETE /settings/areas/:id
  def destroy
    @area.destroy!
    redirect_to settings_delivery_areas_path, notice: "Deleted #{@area.name}. Its orders were kept.", status: :see_other
  end

  private
    def set_area
      @area = DeliveryArea.find(params.expect(:id))
    end

    def area_params
      params.expect(delivery_area: [ :name, :country, :region, :fee, :active ])
    end
end
