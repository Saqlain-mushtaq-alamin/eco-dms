import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Friends } from '../pages/Friends'

export function FriendsRoute() {
    const [searchParams] = useSearchParams()
    const query = searchParams.get('q') || ''

    return <Friends query={query} />
}
