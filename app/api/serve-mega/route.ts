import { NextRequest, NextResponse } from "next/server";
import { File } from "megajs";

// Required for Next.js static export with API routes
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) {
        return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    try {
        const file = File.fromURL(url);
        await file.loadAttributes();

        const stream = file.download({});

        // Convert Node.js stream to Web ReadableStream
        const iterator = stream[Symbol.asyncIterator]();
        const webStream = new ReadableStream({
            async pull(controller) {
                const { value, done } = await iterator.next();
                if (done) {
                    controller.close();
                } else {
                    controller.enqueue(value);
                }
            }
        });

        return new NextResponse(webStream, {
            headers: {
                "Content-Type": "image/jpeg", // Default to jpeg, or try to detect
                "Cache-Control": "public, max-age=86400"
            }
        });

    } catch (error: any) {
        console.error("Mega serve error:", error);
        return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
    }
}
