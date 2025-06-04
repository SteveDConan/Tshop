"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Banner {
  id: string
  title: string
  description: string | null
  imageUrl: string
  link: string | null
}

interface BannerCarouselProps {
  banners: Banner[]
  className?: string
}

export function BannerCarousel({ banners, className }: BannerCarouselProps) {
  const [emblaRef] = useEmblaCarousel(
    {
      loop: true,
      align: "center",
      skipSnaps: false,
    },
    [
      Autoplay({
        delay: 2000,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ]
  )

  if (!banners.length) return null

  return (
    <Carousel
      opts={{
        align: "center",
        loop: true,
        skipSnaps: false,
      }}
      plugins={[
        Autoplay({
          delay: 2000,
          stopOnInteraction: false,
          stopOnMouseEnter: true,
        }),
      ]}
      className={cn("w-full", className)}
    >
      <CarouselContent>
        {banners.map((banner) => (
          <CarouselItem key={banner.id} className="basis-full">
            <Link href={banner.link || "#"}>
              <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
                <CardContent className="p-0">
                  <div className="relative aspect-[13/9] w-full">
                    <Image
                      src={banner.imageUrl}
                      alt={banner.title}
                      fill
                      className="object-cover transition-transform duration-300 hover:scale-105"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-6 text-white">
                      <h3 className="text-2xl font-semibold tracking-tight">
                        {banner.title}
                      </h3>
                      {banner.description && (
                        <p className="mt-2 text-base text-white/90 line-clamp-2">
                          {banner.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-4 hidden md:flex" />
      <CarouselNext className="right-4 hidden md:flex" />
    </Carousel>
  )
} 