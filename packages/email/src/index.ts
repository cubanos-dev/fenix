import { Resend } from 'resend'
import type { ReactElement } from 'react'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: ReactElement
  from?: string
}

export async function sendEmail({ to, subject, react, from }: SendEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: from ?? process.env.EMAIL_FROM ?? 'App <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    react,
  })

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`)
  }

  return data
}
