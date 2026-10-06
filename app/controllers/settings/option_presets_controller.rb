# Settings > Options: the size, length and colour lists used when adding products.
#
# Compare this file with roles_controller.rb: it is the same six actions
# with the same skeleton. That sameness is the point of Rails conventions.
class Settings::OptionPresetsController < InertiaController
  require_permission "settings.manage"
  before_action :set_preset, only: %i[ edit update destroy ]

  # GET /settings/options
  def index
    render inertia: "Settings/OptionPresets/Index", props: {
      presets: OptionPreset.ordered.map { |preset| preset_props(preset) }
    }
  end

  # GET /settings/options/new
  def new
    render inertia: "Settings/OptionPresets/Form", props: { preset: nil, option_names: option_names }
  end

  # POST /settings/options
  def create
    preset = OptionPreset.new(preset_params)

    if preset.save
      redirect_to settings_option_presets_path, notice: "Added #{preset.name}."
    else
      redirect_to new_settings_option_preset_path, inertia: { errors: preset.errors }
    end
  end

  # GET /settings/options/:id/edit
  def edit
    render inertia: "Settings/OptionPresets/Form", props: { preset: preset_props(@preset), option_names: option_names }
  end

  # PATCH /settings/options/:id
  def update
    if @preset.update(preset_params)
      redirect_to settings_option_presets_path, notice: "Saved #{@preset.name}."
    else
      redirect_to edit_settings_option_preset_path(@preset), inertia: { errors: @preset.errors }
    end
  end

  # DELETE /settings/options/:id
  def destroy
    @preset.destroy!
    redirect_to settings_option_presets_path, notice: "Deleted #{@preset.name}.", status: :see_other
  end

  private
    def set_preset
      @preset = OptionPreset.find(params.expect(:id))
    end

    # `values: [[ :label, :swatch ]]` (double brackets) means "an array of
    # hashes, each with these keys".
    def preset_params
      params.expect(option_preset: [ :name, :option_name, values: [ [ :label, :swatch ] ] ])
    end

    def preset_props(preset)
      { id: preset.id, name: preset.name, option_name: preset.option_name, values: preset.values }
    end

    # Suggestions for the "option" box, so "Size" is spelt the same way everywhere.
    def option_names
      (%w[ Size Colour Length ] + OptionPreset.distinct.pluck(:option_name)).uniq
    end
end
