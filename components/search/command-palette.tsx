'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { BookOpen, Home, User, Settings, GraduationCap, Users } from 'lucide-react'

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: string) => {
    setOpen(false)
    router.push(command)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="relative w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="overflow-hidden rounded-lg border bg-popover shadow-xl">
          <Command>
            <CommandInput placeholder="Search courses, navigate to pages..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>

              <CommandGroup heading="Navigation">
                <CommandItem onSelect={() => runCommand('/dashboard')}>
                  <Home className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand('/courses')}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>Courses</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand('/learn/progress')}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>My Progress</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </CommandItem>
              </CommandGroup>

              <CommandGroup heading="Quick Actions">
                <CommandItem onSelect={() => runCommand('/teach/dashboard')}>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  <span>Teacher Dashboard</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand('/admin/users')}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>User Management</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </div>
    </div>
  )
}