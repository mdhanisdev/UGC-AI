export default function SoftBackdrop() {
    return (
        <div className="fixed inset-0 -z-10 pointer-events-none bg-[#05070d]">

            {/* Blue AI glow (main theme) */}
            <div className="absolute inset-0 
                bg-[radial-gradient(circle_at_60%_30%,rgba(56,189,248,0.18),transparent_55%)]" 
            />

            {/* Subtle warm highlight (matches orange light in image) */}
            <div className="absolute inset-0 
                bg-[radial-gradient(circle_at_85%_10%,rgba(255,140,60,0.12),transparent_40%)]" 
            />

            {/* Bottom depth vignette */}
            <div className="absolute inset-0 
                bg-[radial-gradient(circle_at_50%_100%,rgba(0,0,0,0.75),transparent_65%)]" 
            />

            {/* Center soft glow (focus area for hero text) */}
            <div className="absolute left-1/2 top-40 -translate-x-1/2 
                w-[800px] h-[350px] bg-cyan-500/10 rounded-full blur-3xl" 
            />

            {/* Subtle grid (tech feel) */}
            <div className="absolute inset-0 opacity-[0.05] 
                bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),
                    linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]
                bg-[size:60px_60px]" 
            />

            {/* Grain texture */}
            <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay 
                bg-[url('/noise.svg')]"
            />
        </div>
    )
}