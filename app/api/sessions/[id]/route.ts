import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// DELETE: 세션 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 세션 존재 확인
    const session = await prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Cascade 삭제 (Message, File도 함께 삭제됨)
    await prisma.session.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("세션 삭제 오류:", error);
    return NextResponse.json(
      { error: "세션 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
