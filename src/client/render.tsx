import type { ReactNode } from 'react'
import type { Node, Spec } from '../spec/types.ts'
import { renderInline } from './inline.tsx'
import { Card, Grid, Row } from './nodes/Layout.tsx'
import { Stat } from './nodes/Stat.tsx'
import { Table } from './nodes/Table.tsx'
import { Badge, Callout, KeyValue, ListBlock, TextBlock } from './nodes/Text.tsx'

export function renderNode(node: Node, key: number): ReactNode {
  switch (node.type) {
    case 'row': return <Row key={key}>{node.items.map(renderNode)}</Row>
    case 'grid': return <Grid key={key} cols={node.cols}>{node.items.map(renderNode)}</Grid>
    case 'card': return <Card key={key} title={node.title}>{node.items.map(renderNode)}</Card>
    case 'text': return <TextBlock key={key} node={node} />
    case 'callout': return <Callout key={key} node={node} />
    case 'list': return <ListBlock key={key} node={node} />
    case 'keyvalue': return <KeyValue key={key} node={node} />
    case 'badge': return <Badge key={key} text={node.text} tone={node.tone} />
    case 'stat': return <Stat key={key} node={node} />
    case 'table': return <Table key={key} node={node} />
    case 'chart': return null
  }
}

export function CardsBody({ spec }: { readonly spec: Spec }) {
  return (
    <div className="dshc-root">
      {spec.title !== undefined && <div className="dshc-title">{renderInline(spec.title)}</div>}
      {spec.items.map(renderNode)}
    </div>
  )
}
