import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={kicker}>— Keystone</Text>
        <Heading style={h1}>Your sign-in link.</Heading>
        <Text style={text}>
          Tap the button below to open your homebuying plan. The link expires
          shortly, so use it soon.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Open my plan →
        </Button>
        <Text style={footer}>
          Didn't ask to sign in? You can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Cormorant Garamond', Georgia, serif",
}
const container = { padding: '32px 28px', maxWidth: '480px' }
const kicker = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  color: '#c4452d',
  margin: '0 0 16px',
}
const h1 = {
  fontSize: '34px',
  fontWeight: 400 as const,
  color: '#1a1a1a',
  letterSpacing: '-0.02em',
  lineHeight: 1.05,
  margin: '0 0 18px',
}
const text = {
  fontSize: '17px',
  color: '#3d3d3d',
  lineHeight: '1.5',
  margin: '0 0 26px',
}
const button = {
  backgroundColor: '#1a1a1a',
  color: '#f5efe6',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '12px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  borderRadius: '8px',
  padding: '14px 22px',
  textDecoration: 'none',
}
const footer = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '11px',
  letterSpacing: '0.08em',
  color: '#a39888',
  margin: '36px 0 0',
}
