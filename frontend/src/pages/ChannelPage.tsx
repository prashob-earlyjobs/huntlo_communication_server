import { Link } from 'react-router-dom'

type ChannelPageProps = {
  title: string
  description: string
}

export default function ChannelPage({ title, description }: ChannelPageProps) {
  return (
    <main className="channel">
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  )
}
