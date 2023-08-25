"use client"
import { twMerge } from "tailwind-merge"
import {
  HTMLMotionProps,
  MotionValue,
  motion,
  useAnimationControls,
  useDragControls,
  useMotionValue,
  useTransform,
} from "framer-motion"
import { Button } from "./Button"
import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"

import { Slot } from "@radix-ui/react-slot"

type WindowProps = {
  name: string
  layer: MotionValue<number>
  open: MotionValue<boolean>
  fullScreen: MotionValue<boolean>
}

type WindowsMap = Map<string, WindowProps>

type WindowContext = {
  windows: WindowsMap
  setWindows: React.Dispatch<React.SetStateAction<WindowsMap>>
}

type Boundry = {
  top: number
  left: number
  right: number
  bottom: number
}

type WindowBoundryContext = {
  constraints: MotionValue<Boundry | undefined>
}

const WindowContext = createContext<WindowContext | null>(null)
const WindowConstraintsContext = createContext<WindowBoundryContext | null>(
  null
)

function useWindowContext() {
  const context = useContext(WindowContext)

  if (context === null) {
    throw new Error("not in window context")
  }

  return context
}

function useWindowBoundry() {
  const context = useContext(WindowConstraintsContext)
  if (!context) return undefined

  return context.constraints
}

export function useWindows() {
  const { windows } = useWindowContext()
  function focusWindow(id: string) {
    const win = windows.get(id)
    if (!win) return
    const oldLayer = win.layer.get()
    win.layer.set(windows.size)

    windows.forEach((w, key) => {
      if (key === id) return
      const l = w.layer.get()
      if (l > oldLayer) {
        w.layer.set(l - 1)
      }
    })
  }
  const WindowsControlls = [...windows.keys()].map((id) => {
    const w = windows.get(id)

    return {
      id,
      focusWindow: () => focusWindow(id),
      ...w,
    }
  })

  return { WindowsControlls }
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState(new Map())

  return (
    <WindowContext.Provider value={{ windows, setWindows }}>
      {children}
    </WindowContext.Provider>
  )
}

export function Window({
  children,
  className,
  name,
  defaultOpen = true,
  defaultFullScreen = false,
  onClose,
  onPointerDown,
  defaultPosition = { x: 200, y: 200 },
  customId = undefined,
  ...props
}: HTMLMotionProps<"div"> & {
  customId?: string
  name: string
  defaultOpen?: boolean
  defaultFullScreen?: boolean
  defaultPosition?: { x: number; y: number }
  children?: React.ReactElement
  onClose?: (id: string) => void
}) {
  const dragControlls = useDragControls()
  const { windows, setWindows } = useWindowContext()
  const i = useId()
  const id = customId ?? i
  const open = useMotionValue<boolean>(defaultOpen ?? true)
  const fullScreen = useMotionValue<boolean>(
    defaultFullScreen ?? window.innerWidth < 1024 ?? false
  )

  const layer = useMotionValue<number>(windows.size + 1)

  useEffect(() => {
    windows.set(id, {
      open,
      fullScreen,
      name,
      layer,
    })
    setWindows(new Map(windows))

    setPosition(defaultPosition)

    return () => {
      if (!windows.has(id)) return
      const s = windows.delete(id)
      if (s) setWindows(new Map(windows))
    }
  }, [])

  function focusWindow() {
    const win = windows.get(id)
    if (!win) return
    const oldLayer = win.layer.get()
    win.layer.set(windows.size)

    windows.forEach((w, key) => {
      if (key === id) return
      const l = w.layer.get()
      if (l > oldLayer) {
        w.layer.set(l - 1)
      }
    })

    setWindows(new Map(windows))
  }

  const ref = useRef<HTMLDivElement>(null)

  const boundry = useWindowBoundry()
  const constraints = useTransform(() => {
    const c = boundry?.get()
    if (!c) return undefined
    if (ref.current) {
      return {
        top: c.top,
        left: c.left,
        right: c.right - ref.current.clientWidth,
        bottom: c.bottom - ref.current.clientHeight,
      }
    }
    return {
      top: c.top,
      left: c.left,
      right: c.right - 400,
      bottom: c.bottom - 300,
    }
  })

  const inset = useTransform(() => {
    if (fullScreen.get()) return 0
    return "auto"
  })
  const animationControls = useAnimationControls()
  const lastPosition = useMotionValue(defaultPosition)

  fullScreen.on("change", (fs) => {
    if (fs === true)
      return setPosition({
        x: undefined,
        y: undefined,
      })

    if (fs === false) return setPosition(lastPosition.get())
  })
  const visibility = useTransform(() => (open.get() ? "visible" : "hidden"))

  function saveLastPosition({ x, y }: { x: number; y: number }) {
    const c = constraints.get()
    if (c) {
      lastPosition.set({
        x: x > c.right ? c.right : x < c.left ? c.left : x,
        y: y > c.bottom ? c.bottom : y < c.top ? c.top : y,
      })
    } else {
      lastPosition.set({ x, y })
    }
  }

  function setPosition(props: {
    x: number | undefined
    y: number | undefined
  }) {
    return animationControls.set(props)
  }

  return (
    <motion.div
      animate={animationControls}
      className="border-outset border-2 border-zinc-300 select-none"
      layoutId={id}
      ref={ref}
      drag
      dragControls={dragControlls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.1}
      dragConstraints={constraints.get()}
      onDragEnd={(_, info) => saveLastPosition(info.point)}
      style={{
        touchAction: "none",
        position: "absolute",
        minWidth: "400px",
        minHeight: "300px",
        inset,
        zIndex: layer,
        visibility,
      }}
      {...props}
      onPointerDown={(e) => {
        focusWindow()
        onPointerDown && onPointerDown(e)
      }}
    >
      <nav
        className={twMerge(
          "flex select-none flex-row justify-between items-center w-full border-outset border-b-2 bg-gray-400",
          className
        )}
        onPointerDown={(e) => {
          if (!fullScreen.get()) dragControlls.start(e)
        }}
      >
        <h3 className="text-zinc-800 pl-2 text-xl font-bold">{name}</h3>
        <section className="flex gap-x-1 pr-1 py-1">
          <Button
            className="border-2 border-outset font-bold w-[28px]"
            onClick={() => {
              open.set(false)
            }}
          >
            __
          </Button>
          <Button
            className="hidden lg:inline-block border-2 border-outset"
            onClick={() => fullScreen.set(!fullScreen.get())}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path d="M2 4h20v16H2V4zm18 14V6H4v12h16z" fill="currentColor" />
              <path
                d="M2 4h20v16H2V4zm2 14h16V6H4v12zM8 8h2v2H8v2H6V8h2zm8 8h-2v-2h2v-2h2v4h-2z"
                fill="currentColor"
              />
            </svg>
          </Button>
          {onClose ? (
            <Button
              className="border-2 border-outset"
              onClick={() => onClose(id)}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <path
                  d="M5 5h2v2H5V5zm4 4H7V7h2v2zm2 2H9V9h2v2zm2 0h-2v2H9v2H7v2H5v2h2v-2h2v-2h2v-2h2v2h2v2h2v2h2v-2h-2v-2h-2v-2h-2v-2zm2-2v2h-2V9h2zm2-2v2h-2V7h2zm0 0V5h2v2h-2z"
                  fill="currentColor"
                />
              </svg>
            </Button>
          ) : null}
        </section>
      </nav>
      <Slot>{children}</Slot>
    </motion.div>
  )
}

export function WindowsContainer({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  const constraints = useMotionValue<Boundry | undefined>(undefined)

  useEffect(() => {
    if (ref.current) {
      constraints.set(ref.current.getBoundingClientRect())
    }
  }, [])
  return (
    <WindowConstraintsContext.Provider value={{ constraints }}>
      <div {...props} className={twMerge("relative", className)} ref={ref}>
        {children}
      </div>
    </WindowConstraintsContext.Provider>
  )
}
