import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <Container className="flex max-w-md flex-col items-center py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The page you are looking for does not exist or you do not have access
          to it. / আপনি যে পৃষ্ঠাটি খুঁজছেন সেটি নেই বা আপনার প্রবেশাধিকার নেই।
        </p>
        <Button className="mt-6" asChild>
          <Link href="/">Midman.bd</Link>
        </Button>
      </Container>
    </div>
  );
}
