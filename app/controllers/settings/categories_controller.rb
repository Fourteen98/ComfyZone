# Settings > Categories.
class Settings::CategoriesController < InertiaController
  require_permission "settings.manage"
  before_action :set_category, only: %i[ edit update destroy move ]

  # GET /settings/categories
  def index
    # One grouped COUNT for all categories, not one per category.
    counts = Product.group(:category_id).count

    render inertia: "Settings/Categories/Index", props: {
      categories: Category.ordered.map { |category|
        { id: category.id, name: category.name, active: category.active, products_count: counts.fetch(category.id, 0) }
      },
      uncategorised_count: counts.fetch(nil, 0)
    }
  end

  # GET /settings/categories/new
  def new
    render inertia: "Settings/Categories/Form", props: { category: nil }
  end

  # POST /settings/categories
  def create
    category = Category.new(category_params)

    if category.save
      redirect_to settings_categories_path, notice: "Added #{category.name}."
    else
      redirect_to new_settings_category_path, inertia: { errors: category.errors }
    end
  end

  # GET /settings/categories/:id/edit
  def edit
    render inertia: "Settings/Categories/Form", props: {
      category: { id: @category.id, name: @category.name, active: @category.active,
                  products_count: @category.products.count }
    }
  end

  # PATCH /settings/categories/:id
  def update
    if @category.update(category_params)
      redirect_to settings_categories_path, notice: "Saved #{@category.name}."
    else
      redirect_to edit_settings_category_path(@category), inertia: { errors: @category.errors }
    end
  end

  # DELETE /settings/categories/:id
  def destroy
    @category.destroy!
    redirect_to settings_categories_path, notice: "Deleted #{@category.name}. Its products were kept.", status: :see_other
  end

  # PATCH /settings/categories/:id/move?direction=up
  def move
    @category.move(params[:direction] == "up" ? :up : :down)
    redirect_to settings_categories_path
  end

  private
    def set_category
      @category = Category.find(params.expect(:id))
    end

    def category_params
      params.expect(category: [ :name, :active ])
    end
end
