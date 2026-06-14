import Image from "next/image";
import Link from "next/link";

const AuthLayout = ({
  children
}: {
  children: React.ReactNode
}) => {
  return ( 
    <div className="min-h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#18223b] via-[#111827] to-[#0c101b] py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex justify-center">
        <Link href="https://www.guidingdiversity.com">
          <Image
            height={60}
            width={160}
            alt="logo"
            src="/logo.png"
            style={{ objectFit: "contain" }}
            className="hover:opacity-90 transition"
          />
        </Link>
      </div>
      {children}
    </div>
   );
}

export default AuthLayout;