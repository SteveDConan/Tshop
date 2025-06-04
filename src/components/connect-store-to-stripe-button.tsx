"use client"

import * as React from "react"
import { toast } from "sonner"

import { createAccountLink } from "@/lib/actions/stripe"
import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Icons } from "@/components/icons"

interface ConnectToStripeButtonProps extends ButtonProps {
  storeId: string
}

export function ConnectStoreToStripeButton({
  storeId,
  className,
  ...props
}: ConnectToStripeButtonProps) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleConnect = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await createAccountLink({ storeId })

      if (error) {
        setError(error)
        toast.error(error)
        return
      }

      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error("Failed to get Stripe account link URL")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred while connecting to Stripe"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      aria-label="Connect to Stripe"
      className={cn(className)}
      onClick={handleConnect}
      disabled={loading}
      {...props}
    >
      {loading && (
        <Icons.spinner
          className="mr-2 size-4 animate-spin"
          aria-hidden="true"
        />
      )}
      {error ? "Retry Connection" : "Connect to Stripe"}
    </Button>
  )
}
