import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const awsUrl = `${process.env.NEXT_PUBLIC_AWS_IP}/data/download/${jobId}`


  try {
    const res = await fetch(awsUrl, {
      headers: {
        "X-API-Key": process.env.API_SECRET_KEY as string,
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch file from AWS" }, { status: res.status })
    }

    // Proxy the file stream
    const blob = await res.blob()
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="trading_data_${jobId}.csv"`,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
