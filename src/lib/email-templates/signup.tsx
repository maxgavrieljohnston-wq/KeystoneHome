import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  token,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Verify your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={kicker}>— Keystone</Text>
        <Heading style={h1}>Verify your email.</Heading>
        <Text style={text}>
          Thanks for signing up! Your verification code is:
        </Text>
        <div style={codeBox}>
          <Text style={codeText}>{token}</Text>
        </div>
        <Text style={text}>
          You can also tap the button below to verify your email.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verify Email →
        </Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const codeBox = {
  background: '#f5efe6',
  padding: '16px',
  borderRadius: '8px',
  textAlign: 'center' as const,
  marginBottom: '26px',
}
const codeText = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '28px',
  letterSpacing: '0.2em',
  color: '#1a1a1a',
  margin: 0,
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
