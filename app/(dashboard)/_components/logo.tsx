import Image from "next/image";

export const Logo = () => {
  return (
    <Image
      height={50}
      width={130}
      alt="logo"
      src="/logo.png"
      style={{ objectFit: "contain" }}
    />
  )
}