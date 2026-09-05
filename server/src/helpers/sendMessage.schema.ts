import Joi from "joi";

const smtpSchema = Joi.object({
  from: Joi.string().email().optional(),
  displayName: Joi.string().optional().allow("").default(""),
  username: Joi.string().optional(),
  password: Joi.string().required().messages({
    "any.required": "smtp.password is required for SMTP",
  }),
  smtpHost: Joi.string().required().messages({
    "any.required": "smtp.smtpHost is required for SMTP",
  }),
  smtpPort: Joi.number().default(587),
  security: Joi.string()
    .uppercase()
    .valid("STARTTLS", "SSL", "TLS", "NONE")
    .default("STARTTLS"),
  imapHost: Joi.string().optional().allow(""),
  imapPort: Joi.number().default(993),
})
  .or("from", "username")
  .messages({
    "object.missing": "smtp.from or smtp.username is required for SMTP",
  });

export const sendMessageSchema = Joi.object({
  type: Joi.string()
    .valid("email", "whatsapp", "call")
    .required()
    .messages({
      "any.required": "type is required",
      "any.only": "type must be one of email, whatsapp, or call",
    }),

  vendor: Joi.string()
    .required()
    .when("type", {
      is: "email",
      then: Joi.valid("gmail", "outlook", "smtp").messages({
        "any.only": "email vendor must be gmail, outlook, or smtp",
      }),
      otherwise: Joi.when("type", {
        is: "whatsapp",
        then: Joi.valid("huntlo").messages({
          "any.only": "whatsapp vendor must be huntlo",
        }),
        otherwise: Joi.valid("hunar", "zyvkay").messages({
          "any.only": "call vendor must be hunar or zyvkay",
        }),
      }),
    })
    .messages({
      "any.required": "vendor is required",
    }),

  to: Joi.when("type", {
    is: "email",
    then: Joi.string().email().required().messages({
      "any.required": "to is required",
      "string.email": "to must be a valid email address",
    }),
    otherwise: Joi.when("type", {
      is: "call",
      then: Joi.forbidden(),
      otherwise: Joi.string().required().messages({
        "any.required": "to is required",
      }),
    }),
  }),

  subject: Joi.when("type", {
    is: "email",
    then: Joi.string().optional().allow(""),
    otherwise: Joi.forbidden(),
  }),

  body: Joi.when("type", {
    is: "email",
    then: Joi.when("html", {
      is: Joi.exist(),
      then: Joi.string().optional().allow(""),
      otherwise: Joi.string().required().messages({
        "any.required": "body is required when html is not provided",
      }),
    }),
    otherwise: Joi.when("type", {
      is: "whatsapp",
      then: Joi.when("template", {
        is: Joi.exist(),
        then: Joi.string().optional().allow(""),
        otherwise: Joi.string().required().messages({
          "any.required": "body is required when template is not provided",
        }),
      }),
      otherwise: Joi.forbidden(),
    }),
  }),

  html: Joi.when("type", {
    is: "email",
    then: Joi.string().optional(),
    otherwise: Joi.forbidden(),
  }),

  from: Joi.when("type", {
    is: "email",
    then: Joi.string().optional().allow(null, ""),
    otherwise: Joi.forbidden(),
  }),

  smtp: Joi.when("vendor", {
    is: "smtp",
    then: smtpSchema.required().messages({
      "any.required": "smtp config is required when vendor is smtp",
    }),
    otherwise: Joi.forbidden(),
  }),

  accessToken: Joi.when("vendor", {
    is: Joi.valid("gmail", "outlook"),
    then: Joi.string().min(1).required().messages({
      "any.required": "accessToken is required for gmail and outlook",
      "string.empty": "accessToken is required for gmail and outlook",
      "string.min": "accessToken is required for gmail and outlook",
    }),
    otherwise: Joi.forbidden(),
  }),

  refreshToken: Joi.when("vendor", {
    is: Joi.valid("gmail", "outlook"),
    then: Joi.string().optional(),
    otherwise: Joi.forbidden(),
  }),

  threadId: Joi.when("vendor", {
    is: Joi.valid("gmail", "huntlo"),
    then: Joi.string().optional().allow(null, ""),
    otherwise: Joi.forbidden(),
  }),

  inReplyTo: Joi.when("vendor", {
    is: "gmail",
    then: Joi.string().optional().allow(null, ""),
    otherwise: Joi.forbidden(),
  }),

  references: Joi.when("vendor", {
    is: "gmail",
    then: Joi.string().optional().allow(null, ""),
    otherwise: Joi.forbidden(),
  }),

  template: Joi.when("type", {
    is: "whatsapp",
    then: Joi.string().optional(),
    otherwise: Joi.forbidden(),
  }),

  variables: Joi.when("type", {
    is: "whatsapp",
    then: Joi.array().items(Joi.string()).optional(),
    otherwise: Joi.forbidden(),
  }),

  agent_id: Joi.when("type", {
    is: "call",
    then: Joi.when("vendor", {
      is: "hunar",
      then: Joi.string().required().messages({
        "any.required": "agent_id is required for hunar",
      }),
      otherwise: Joi.string().optional().allow("", null),
    }),
    otherwise: Joi.forbidden(),
  }),

  campaign_id: Joi.when("type", {
    is: "call",
    then: Joi.string().required().messages({
      "any.required": "campaign_id is required for call",
    }),
    otherwise: Joi.string().optional().allow("", null),
  }),

  campaignId: Joi.string().optional().allow("", null),

  data: Joi.when("type", {
    is: "call",
    then: Joi.array()
      .items(
        Joi.object({
          callee_name: Joi.string().required().messages({
            "any.required": "data.callee_name is required",
          }),
          mobile_number: Joi.string().required().messages({
            "any.required": "data.mobile_number is required",
          }),
          custom_data: Joi.object()
            .pattern(Joi.string(), Joi.string().allow(""))
            .optional(),
        })
      )
      .min(1)
      .required()
      .messages({
        "any.required": "data is required for call",
        "array.min": "data must include at least one callee",
      }),
    otherwise: Joi.forbidden(),
  }),

  questions: Joi.when("type", {
    is: "call",
    then: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            id: Joi.string().optional().allow("", null),
            question: Joi.string().required(),
            required: Joi.boolean().optional(),
            pass_condition: Joi.string().optional().allow("", null),
          })
        ),
        Joi.string()
      )
      .optional(),
    otherwise: Joi.forbidden(),
  }),

  prompt: Joi.when("vendor", {
    is: "zyvkay",
    then: Joi.string().required().messages({
      "any.required": "prompt is required for zyvkay",
    }),
    otherwise: Joi.string().optional().allow(""),
  }),
  metadata: Joi.object().optional(),
  idempotencyKey: Joi.string().optional(),
});
