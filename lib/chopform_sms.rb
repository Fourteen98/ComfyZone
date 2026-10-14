# frozen_string_literal: true

require 'json'
require 'net/http'
require 'securerandom'
require 'uri'

# Thin client for the ChopForm SMS gateway (chopform.com's Platform API).
#
# Flow:
#   1. A ChopForm platform admin creates an "Integration Partner" for
#      ComfyZone at /platform/integration-partners and issues an API key.
#      The key is shown once; the admin pastes it into our Rails
#      credentials (see below).
#   2. This client posts to https://app.chopform.com/api/v1/sms/send with
#      Authorization: Bearer <key>. Each SMS debits our prepaid wallet.
#   3. If the wallet is empty we get HTTP 402; top up on the ChopForm
#      admin UI and retry.
#
# Configure in config/credentials.yml.enc:
#
#   chopform_sms:
#     api_key: cf_live_XXXXXXXXXXXXXXXXXXXXXXXX
#     base_url: https://app.chopform.com     # override only for staging
#
# Or via ENV (useful in CI / dev):
#
#   CHOPFORM_SMS_API_KEY=cf_live_...
#   CHOPFORM_SMS_BASE_URL=https://app.chopform.com
#
# Usage:
#
#   ChopformSms.send!(to: "+233241234567", message: "Order #42 is ready")
#
# Idempotent retries:
#
#   ChopformSms.send!(
#     to: "+233241234567",
#     message: "...",
#     client_reference: "order-42-ready",
#   )
#
# Resend with the same client_reference and we get the stored outcome
# back instead of a double send.
#
# Thread-safe: no shared mutable state.
module ChopformSms
  class Error < StandardError
    attr_reader :status, :body

    def initialize(message, status: nil, body: nil)
      super(message)
      @status = status
      @body = body
    end
  end

  class InsufficientFundsError < Error; end
  class UnauthorizedError < Error; end
  class RateLimitedError < Error; end
  class ServerError < Error; end

  TIMEOUT_SECONDS = 10

  class << self
    # @return [Hash] parsed JSON response from the gateway
    # @raise [Error] subclasses on 4xx/5xx responses
    def send!(to:, message:, client_reference: nil)
      post('/api/v1/sms/send',
           to: to,
           message: message,
           client_reference: client_reference)
    end

    # @return [Hash] { "balance" => Float, "currency" => "GHS", ... }
    def balance
      get('/api/v1/sms/balance')
    end

    # @return [Array<Hash>] the N most recent messages
    def recent(limit: 20)
      get('/api/v1/sms/messages', limit: limit)['data']
    end

    private

    def post(path, payload)
      uri = URI.join(base_url, path)
      req = Net::HTTP::Post.new(uri)
      req['Authorization'] = "Bearer #{api_key}"
      req['Accept'] = 'application/json'
      req['Content-Type'] = 'application/json'
      req.body = payload.compact.to_json
      perform(uri, req)
    end

    def get(path, query = {})
      uri = URI.join(base_url, path)
      uri.query = URI.encode_www_form(query) unless query.empty?
      req = Net::HTTP::Get.new(uri)
      req['Authorization'] = "Bearer #{api_key}"
      req['Accept'] = 'application/json'
      perform(uri, req)
    end

    def perform(uri, req)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')
      http.open_timeout = TIMEOUT_SECONDS
      http.read_timeout = TIMEOUT_SECONDS

      res = http.request(req)
      body = begin
        res.body && res.body.strip.empty? ? {} : JSON.parse(res.body || '{}')
      rescue JSON::ParserError
        { 'raw' => res.body }
      end

      case res.code.to_i
      when 200, 201 then body
      when 401 then raise UnauthorizedError.new('ChopForm API rejected the key',
                                                status: 401, body: body)
      when 402 then raise InsufficientFundsError.new(
        body['reason'] || 'ChopForm SMS wallet is empty — top up and retry.',
        status: 402, body: body
      )
      when 403 then raise Error.new(body['reason'] || 'Forbidden', status: 403, body: body)
      when 422 then raise Error.new(
        "Invalid payload: #{body['errors'] || body['message']}",
        status: 422, body: body
      )
      when 429 then raise RateLimitedError.new('ChopForm API rate-limited this key',
                                               status: 429, body: body)
      when 500..599 then raise ServerError.new(
        "ChopForm gateway error (#{res.code})",
        status: res.code.to_i, body: body
      )
      else
        raise Error.new("Unexpected HTTP #{res.code}", status: res.code.to_i, body: body)
      end
    end

    def api_key
      key = resolve_credential(:api_key) || ENV['CHOPFORM_SMS_API_KEY']
      raise Error, 'ChopForm SMS API key not configured' if key.nil? || key.empty?

      key
    end

    def base_url
      resolve_credential(:base_url) ||
        ENV['CHOPFORM_SMS_BASE_URL'] ||
        'https://app.chopform.com'
    end

    # Only use Rails credentials if the Rails constant is loaded. Keeps
    # this module usable in a plain-Ruby context (tests, console).
    def resolve_credential(key)
      return nil unless defined?(::Rails) && ::Rails.application&.credentials&.chopform_sms

      ::Rails.application.credentials.chopform_sms[key]
    end
  end
end
