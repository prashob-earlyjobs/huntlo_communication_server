import { useEffect, useState } from 'react'

const SEND_URL = 'http://localhost:5055/api/v1/messages/send'

type Example = {
  id: string
  title: string
  note: string
  curl: string
}

type Section = {
  id: string
  label: string
  intro: string
  rules: string[]
  examples: Example[]
}

function prettyCurl(path: string, body: Record<string, unknown>) {
  const json = JSON.stringify(body, null, 2)
  return `curl -X POST "${SEND_URL}${path}" \\
  -H "Content-Type: application/json" \\
  -d '${json}'`
}

const sections: Section[] = [
  {
    id: 'email',
    label: 'Email',
    intro: 'type is email. vendor is gmail, outlook, or smtp. to must be an email address.',
    rules: [
      'body is required unless html is sent.',
      'gmail and outlook require accessToken. refreshToken is optional.',
      'smtp requires an smtp object. Do not send accessToken.',
      'threadId, inReplyTo, and references are gmail-only.',
      'from is optional. For SMTP, smtp.from or smtp.username is required.',
    ],
    examples: [
      {
        id: 'gmail-text',
        title: 'Gmail — plain text',
        note: 'Minimum Gmail send. accessToken is required.',
        curl: prettyCurl('', {
          type: 'email',
          vendor: 'gmail',
          to: 'candidate@example.com',
          from: 'recruiter@company.com',
          subject: 'Interview follow-up',
          body: 'Hi, are you available this week?',
          accessToken: 'ya29.ACCESS_TOKEN',
        }),
      },
      {
        id: 'gmail-html',
        title: 'Gmail — HTML',
        note: 'html can replace body. body is optional when html is present.',
        curl: prettyCurl('', {
          type: 'email',
          vendor: 'gmail',
          to: 'candidate@example.com',
          from: 'recruiter@company.com',
          subject: 'Interview follow-up',
          html: '<p>Hi, are you available this week?</p>',
          accessToken: 'ya29.ACCESS_TOKEN',
        }),
      },
      {
        id: 'gmail-reply',
        title: 'Gmail — reply in thread',
        note: 'threadId, inReplyTo, and references keep the reply in the same Gmail thread.',
        curl: prettyCurl('', {
          type: 'email',
          vendor: 'gmail',
          to: 'candidate@example.com',
          from: 'recruiter@company.com',
          subject: 'Re: Interview follow-up',
          body: 'Thanks — Tuesday at 3pm works.',
          accessToken: 'ya29.ACCESS_TOKEN',
          threadId: '18c1abcd1234efgh',
          inReplyTo: '<CAMail.id@mail.gmail.com>',
          references: '<CAMail.id@mail.gmail.com>',
        }),
      },
      {
        id: 'gmail-refresh',
        title: 'Gmail — with refresh token',
        note: 'refreshToken is optional. The server can also refresh from userintegrations.',
        curl: prettyCurl('', {
          type: 'email',
          vendor: 'gmail',
          to: 'candidate@example.com',
          from: 'recruiter@company.com',
          subject: 'Interview follow-up',
          body: 'Hi, are you available this week?',
          accessToken: 'ya29.ACCESS_TOKEN',
          refreshToken: '1//REFRESH_TOKEN',
        }),
      },
      {
        id: 'gmail-autoreply',
        title: 'Gmail — auto-reply',
        note: 'Query autoReply=true requires prompt and campaignId (or campaign_id).',
        curl: prettyCurl('?autoReply=true', {
          type: 'email',
          vendor: 'gmail',
          to: 'candidate@example.com',
          from: 'recruiter@company.com',
          subject: 'Role at Humtlo',
          body: 'Hi, we have an opening that matches your profile.',
          accessToken: 'ya29.ACCESS_TOKEN',
          prompt: 'You are a recruiter. Qualify interest and suggest interview slots.',
          campaignId: 'camp_123',
        }),
      },
      {
        id: 'outlook-text',
        title: 'Outlook — plain text',
        note: 'Same as Gmail, but threadId / inReplyTo / references are not allowed.',
        curl: prettyCurl('', {
          type: 'email',
          vendor: 'outlook',
          to: 'candidate@example.com',
          from: 'recruiter@company.com',
          subject: 'Interview follow-up',
          body: 'Hi, are you available this week?',
          accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6...',
        }),
      },
      {
        id: 'outlook-html',
        title: 'Outlook — HTML',
        note: 'html can replace body.',
        curl: prettyCurl('', {
          type: 'email',
          vendor: 'outlook',
          to: 'candidate@example.com',
          subject: 'Interview follow-up',
          html: '<p>Hi, are you available this week?</p>',
          accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6...',
        }),
      },
      {
        id: 'outlook-autoreply',
        title: 'Outlook — auto-reply',
        note: 'Same autoReply rules: prompt and campaignId are required.',
        curl: prettyCurl('?autoReply=true', {
          type: 'email',
          vendor: 'outlook',
          to: 'candidate@example.com',
          subject: 'Role at Humtlo',
          body: 'Hi, we have an opening that matches your profile.',
          accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6...',
          prompt: 'You are a recruiter. Qualify interest and suggest interview slots.',
          campaignId: 'camp_123',
        }),
      },
      {
        id: 'smtp-text',
        title: 'SMTP — STARTTLS',
        note: 'smtp is required. Provide smtp.from or smtp.username. Do not send accessToken.',
        curl: prettyCurl('', {
          type: 'email',
          vendor: 'smtp',
          to: 'candidate@example.com',
          subject: 'Interview follow-up',
          body: 'Hi, are you available this week?',
          smtp: {
            from: 'recruiter@company.com',
            displayName: 'Humtlo Recruiting',
            username: 'recruiter@company.com',
            password: 'app-password',
            smtpHost: 'smtp.gmail.com',
            smtpPort: 587,
            security: 'STARTTLS',
          },
        }),
      },
      {
        id: 'smtp-ssl',
        title: 'SMTP — SSL',
        note: 'security can be STARTTLS, SSL, TLS, or NONE. smtpPort defaults to 587.',
        curl: prettyCurl('', {
          type: 'email',
          vendor: 'smtp',
          to: 'candidate@example.com',
          subject: 'Interview follow-up',
          html: '<p>Hi, are you available this week?</p>',
          smtp: {
            username: 'recruiter@company.com',
            password: 'app-password',
            smtpHost: 'smtp.office365.com',
            smtpPort: 465,
            security: 'SSL',
          },
        }),
      },
      {
        id: 'smtp-autoreply',
        title: 'SMTP — auto-reply',
        note: 'autoReply still requires prompt and campaignId.',
        curl: prettyCurl('?autoReply=true', {
          type: 'email',
          vendor: 'smtp',
          to: 'candidate@example.com',
          subject: 'Role at Humtlo',
          body: 'Hi, we have an opening that matches your profile.',
          prompt: 'You are a recruiter. Qualify interest and suggest interview slots.',
          campaignId: 'camp_123',
          smtp: {
            from: 'recruiter@company.com',
            password: 'app-password',
            smtpHost: 'smtp.gmail.com',
            smtpPort: 587,
            security: 'STARTTLS',
          },
        }),
      },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    intro: 'type is whatsapp. vendor must be huntlo. to is the recipient phone number.',
    rules: [
      'body is required unless template is sent.',
      'template can include variables as a string array.',
      'threadId is optional and continues an existing conversation.',
      'autoReply=true requires prompt and campaignId (or campaign_id).',
    ],
    examples: [
      {
        id: 'wa-text',
        title: 'WhatsApp — text',
        note: 'Minimum Huntlo text send.',
        curl: prettyCurl('', {
          type: 'whatsapp',
          vendor: 'huntlo',
          to: '919876543210',
          body: 'Hi, thanks for applying. Are you open to a quick chat?',
        }),
      },
      {
        id: 'wa-template',
        title: 'WhatsApp — template',
        note: 'body is optional when template is present.',
        curl: prettyCurl('', {
          type: 'whatsapp',
          vendor: 'huntlo',
          to: '919876543210',
          template: 'interview_invite',
          variables: ['Aisha', 'Tuesday 3pm'],
        }),
      },
      {
        id: 'wa-thread',
        title: 'WhatsApp — existing thread',
        note: 'threadId attaches the outbound message to a conversation.',
        curl: prettyCurl('', {
          type: 'whatsapp',
          vendor: 'huntlo',
          to: '919876543210',
          body: 'Following up on yesterday’s message.',
          threadId: 'wa_thread_abc123',
        }),
      },
      {
        id: 'wa-autoreply',
        title: 'WhatsApp — auto-reply',
        note: 'Creates or continues a conversation and stores prompt + campaignId.',
        curl: prettyCurl('?autoReply=true', {
          type: 'whatsapp',
          vendor: 'huntlo',
          to: '919876543210',
          body: 'Hi, we have an opening that matches your profile.',
          prompt: 'You are a recruiter. Qualify interest over WhatsApp.',
          campaignId: 'camp_123',
        }),
      },
    ],
  },
  {
    id: 'call',
    label: 'Call',
    intro: 'type is call. vendor is hunar or zyvkay. Do not send to, body, html, or smtp.',
    rules: [
      'hunar requires agent_id and campaign_id.',
      'zyvkay requires prompt and campaign_id. agent_id is not used.',
      'data must include at least one callee with callee_name and mobile_number.',
      'custom_data values must be strings.',
      'to is forbidden for calls.',
    ],
    examples: [
      {
        id: 'call-one',
        title: 'Call — one callee',
        note: 'Minimum Hunar call. campaign_id is required even without autoReply.',
        curl: prettyCurl('', {
          type: 'call',
          vendor: 'hunar',
          agent_id: 'agent_123',
          campaign_id: 'camp_456',
          data: [
            {
              callee_name: 'Aisha Khan',
              mobile_number: '919876543210',
            },
          ],
        }),
      },
      {
        id: 'call-custom',
        title: 'Call — custom data',
        note: 'custom_data is optional. Keys map to string values only.',
        curl: prettyCurl('', {
          type: 'call',
          vendor: 'hunar',
          agent_id: 'agent_123',
          campaign_id: 'camp_456',
          data: [
            {
              callee_name: 'Aisha Khan',
              mobile_number: '919876543210',
              custom_data: {
                role: 'Backend Engineer',
                city: 'Bengaluru',
              },
            },
          ],
        }),
      },
      {
        id: 'call-many',
        title: 'Call — multiple callees',
        note: 'Each object in data is a separate callee.',
        curl: prettyCurl('', {
          type: 'call',
          vendor: 'hunar',
          agent_id: 'agent_123',
          campaign_id: 'camp_456',
          data: [
            {
              callee_name: 'Aisha Khan',
              mobile_number: '919876543210',
            },
            {
              callee_name: 'Rohit Sharma',
              mobile_number: '918765432109',
              custom_data: { role: 'Frontend Engineer' },
            },
          ],
        }),
      },
      {
        id: 'call-zyvkay',
        title: 'Call — Zyvka / Zyastra',
        note: 'No agent_id. prompt is the voice agent script. Callbacks go to /api/v1/webhooks/zyvkay.',
        curl: prettyCurl('', {
          type: 'call',
          vendor: 'zyvkay',
          campaign_id: 'camp_456',
          prompt:
            'You are Roshni, a friendly AI recruiter. Screen the candidate and collect notice period, CTC, and interest.',
          data: [
            {
              callee_name: 'Gokul Kumar',
              mobile_number: '+14155550123',
            },
          ],
        }),
      },
      {
        id: 'call-autoreply',
        title: 'Call — auto-reply / screening prompt',
        note: 'autoReply=true still requires prompt. campaign_id already satisfies campaignId.',
        curl: prettyCurl('?autoReply=true', {
          type: 'call',
          vendor: 'hunar',
          agent_id: 'agent_123',
          campaign_id: 'camp_456',
          prompt: 'Screen for backend experience and notice period.',
          data: [
            {
              callee_name: 'Aisha Khan',
              mobile_number: '919876543210',
            },
          ],
        }),
      },
    ],
  },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <button type="button" className="docs-copy" onClick={copy}>
      {copied ? 'Copied' : 'Copy curl'}
    </button>
  )
}

export default function Docs() {
  const [section, setSection] = useState(sections[0].id)
  const current = sections.find((item) => item.id === section) || sections[0]

  return (
    <main className="docs">
      <header className="queue-header">
        <div>
          <p className="eyebrow">API</p>
          <h1>Documentation</h1>
          <p className="lede">
            POST <code>/api/v1/messages/send</code> — every type, vendor, and
            auto-reply combination with copyable curl.
          </p>
        </div>
      </header>

      <section className="docs-overview">
        <p>
          Base URL: <code>{SEND_URL}</code>
        </p>
        <p>
          Optional query: <code>?autoReply=true</code>. When set,{' '}
          <code>prompt</code> and <code>campaignId</code> (or{' '}
          <code>campaign_id</code>) are required.
        </p>
        <div className="queue-table-wrap">
          <table className="queue-table">
            <thead>
              <tr>
                <th>type</th>
                <th>vendor</th>
                <th>Required</th>
                <th>Forbidden</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>email</td>
                <td>gmail</td>
                <td>to, accessToken, body or html</td>
                <td>smtp, template, agent_id, data</td>
              </tr>
              <tr>
                <td>email</td>
                <td>outlook</td>
                <td>to, accessToken, body or html</td>
                <td>smtp, threadId, inReplyTo, references</td>
              </tr>
              <tr>
                <td>email</td>
                <td>smtp</td>
                <td>to, smtp, body or html</td>
                <td>accessToken</td>
              </tr>
              <tr>
                <td>whatsapp</td>
                <td>huntlo</td>
                <td>to, body or template</td>
                <td>smtp, accessToken, html, agent_id</td>
              </tr>
              <tr>
                <td>call</td>
                <td>hunar</td>
                <td>agent_id, campaign_id, data[]</td>
                <td>to, body, html, smtp, template</td>
              </tr>
              <tr>
                <td>call</td>
                <td>zyvkay</td>
                <td>prompt, campaign_id, data[]</td>
                <td>to, body, html, smtp, template</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="docs-optional">
          Optional on any type: <code>metadata</code>, <code>idempotencyKey</code>
          , <code>campaignId</code>. Call also accepts{' '}
          <code>campaign_id</code>. SMTP <code>security</code>: STARTTLS, SSL,
          TLS, NONE.
        </p>
      </section>

      <div className="logs-toolbar">
        <div className="queue-filters" role="tablist" aria-label="Send type">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              className={`queue-filter${section === item.id ? ' is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="docs-section">
        <h2>{current.label}</h2>
        <p className="lede">{current.intro}</p>
        <ul className="docs-rules">
          {current.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <div className="docs-examples">
          {current.examples.map((example) => (
            <article key={example.id} id={example.id} className="docs-card">
              <div className="docs-card-header">
                <div>
                  <h3>{example.title}</h3>
                  <p>{example.note}</p>
                </div>
                <CopyButton text={example.curl} />
              </div>
              <pre className="docs-pre">
                <code>{example.curl}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
