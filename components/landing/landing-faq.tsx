'use client'

import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export function LandingFaq({
  items,
}: {
  items: { question: string; answer: string }[]
}) {
  const [open, setOpen] = useState<string[]>([])

  return (
    <div onMouseLeave={() => setOpen([])}>
      <Accordion
        value={open}
        onValueChange={setOpen}
        className="mt-6 overflow-hidden rounded-xl border bg-card"
      >
        {items.map((item, index) => {
          const value = String(index)
          return (
            <AccordionItem
              key={item.question}
              value={value}
              className="px-6"
              onMouseEnter={() => setOpen([value])}
            >
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
