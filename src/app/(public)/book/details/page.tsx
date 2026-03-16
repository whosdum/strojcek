"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingSteps } from "@/components/booking/booking-steps";
import { ContactForm } from "@/components/booking/contact-form";

export default function BookingDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams.get("serviceId");
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");
  const time = searchParams.get("time");

  useEffect(() => {
    if (!serviceId || !barberId || !date || !time) {
      router.replace("/book");
    }
  }, [serviceId, barberId, date, time, router]);

  if (!serviceId || !barberId || !date || !time) return null;

  const handleSubmit = (data: {
    firstName: string;
    lastName?: string;
    phone: string;
    email: string;
    note?: string;
  }) => {
    const params = new URLSearchParams({
      serviceId,
      barberId,
      date,
      time,
      firstName: data.firstName,
      lastName: data.lastName || "",
      phone: data.phone,
      email: data.email,
      note: data.note || "",
    });
    router.push(`/book/confirm?${params.toString()}`);
  };

  return (
    <>
      <BookingSteps currentStep={4} />
      <h2 className="mb-4 text-lg font-semibold">Vaše kontaktné údaje</h2>
      <ContactForm onSubmit={handleSubmit} />
    </>
  );
}
