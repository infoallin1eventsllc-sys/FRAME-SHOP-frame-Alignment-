import { ServiceItem, WorkProject, Testimonial } from '../types';

export const SHOP_INFO = {
  name: "The Frame Shop",
  subTitle: "Frame & Alignment",
  owner: "Paul Hurey",
  role: "Owner / Head Mechanic",
  tagline: "This isn't just work. It's a craft. A reputation. A way of life.",
  address: "7531 Unit C Root Road, Spring, Texas 77389",
  phone: "(832) 628-5226",
  phoneRaw: "8326285226",
  hours: "Tuesday through Saturday by appointment only",
  instagramHandle: "@_theframeshop",
  instagramUrl: "https://www.instagram.com/_theframeshop/",
  mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3448.818!2d-95.5398!3d30.1084!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864735c05c05c05c%3A0x0!2s7531+Root+Rd+Unit+C%2C+Spring%2C+TX+77389!5e0!3m2!1sen!2sus!4v1680000000000!5m2!1sen!2sus"
};

export const CORE_VALUES = [
  {
    id: "rider-first",
    title: "RIDER-FIRST",
    subtitle: "UNCOMPROMISING QUALITY",
    desc: "If it wouldn’t meet our standard, it doesn’t leave the shop."
  },
  {
    id: "integrity",
    title: "INTEGRITY & TRANSPARENCY",
    subtitle: "HONEST DIAGNOSTICS",
    desc: "No guessing. No shortcuts. Just straight answers and real work."
  },
  {
    id: "craftsmanship",
    title: "PRECISION CRAFTSMANSHIP",
    subtitle: "ENGINEERED ACCURACY",
    desc: "Exact measurements. Stronger frames. Perfect alignment."
  },
  {
    id: "ride-ready",
    title: "RIDE-READY STANDARD",
    subtitle: "PERSONAL GUARANTEE",
    desc: "If I won’t ride it, neither will you."
  }
];

export const SERVICES: ServiceItem[] = [
  {
    id: "frame-repair",
    title: "Frame Repair & Straightening",
    category: "core",
    shortDesc: "Precision hydraulic frame straightening, neck rake restoration, and structural TIG crack repair.",
    fullDesc: "Modern powertrains generate extreme torque that can twist factory chasses or exacerbate subtle frame damage from crashes or tip-overs. We use heavy-duty laser alignment jigs and hydraulic pullers to restore neck angle, backbone straightness, and swingarm pivot symmetry to exact spec.",
    features: [
      "Neck rake & trail measurement & correction",
      "Hydraulic chassis straightening on heavy-duty jig",
      "Swingarm pivot & backbone axial alignment",
      "Structural crack inspection & high-stress TIG repair",
      "Post-crash dimensional verification with digital report"
    ],
    estimatedTime: "2 - 5 Days",
    startingPrice: "From $650 (Tiered on Inspection)",
    iconName: "Frame"
  },
  {
    id: "powertrain-alignment",
    title: "Power Train Alignment",
    category: "core",
    shortDesc: "3D laser alignment of motor, transmission, primary drive, and rear wheel tracking.",
    fullDesc: "High-horsepower V-Twin baggers push far beyond factory chassis limits. If your engine, transmission, and rear wheel aren't in 3D parallel alignment, you experience high-speed rear wobble above 65mph, belt/chain snapping, and severe vibration. We align the entire powertrain unit relative to the frame centerline.",
    features: [
      "3D Laser powertrain tracking scan",
      "Engine & transmission isolation mount setup",
      "Primary belt/chain alignment & tensioning",
      "Stabilizer link tuning & torque-lock",
      "High-speed bagger wobble elimination guarantee"
    ],
    estimatedTime: "1 - 2 Days",
    startingPrice: "$380",
    iconName: "Compass"
  },
  {
    id: "suspension-tuning",
    title: "Suspension Tuning",
    category: "core",
    shortDesc: "Custom spring rate, damping, sag, and triple tree fork anti-stiction alignment.",
    fullDesc: "Proper suspension setup transforms how a heavy cruiser corners, brakes, and handles high-speed dips. We dial in front fork preload and re-valving, align triple trees to eliminate fork stiction, and tune rear shocks specifically to your body weight, passenger load, and engine output.",
    features: [
      "Rider sag & preload calibration",
      "Triple tree & fork leg anti-stiction laser alignment",
      "Compression & rebound damping adjustment",
      "Performance cartridge & Öhlins/Legends shock installation",
      "Cornering geometry optimization"
    ],
    estimatedTime: "1 Day",
    startingPrice: "$280",
    iconName: "Sliders"
  },
  {
    id: "tire-balance",
    title: "Tire Changes & Dynamic Balance",
    category: "maintenance",
    shortDesc: "Precision scratch-free wheel mounting, spoke truing, and electronic spin balancing.",
    fullDesc: "High-torque baggers and custom cruisers need flawless wheel balance to prevent cupping and high-speed handle vibration. We offer scratch-free tire mounting, spoke wheel trueing, and dynamic spin balancing.",
    features: [
      "Scratch-free rim mounting for custom wheels",
      "Spoke wheel truing & tensioning",
      "High-speed dynamic spin balancing",
      "Valve stem replacement & bead seal check",
      "Axle & wheel bearing inspection"
    ],
    estimatedTime: "1 - 2 Hours",
    startingPrice: "$75 per wheel",
    iconName: "Disc"
  },
  {
    id: "brake-inspections",
    title: "Brake Inspections & Upgrades",
    category: "maintenance",
    shortDesc: "Digital rotor runout measurement, caliper piston alignment, and performance pad install.",
    fullDesc: "More horsepower demands superior stopping capability. We inspect brake rotor warp with digital dial indicators, align caliper pistons to eliminate drag, flush old fluid with high-temp DOT synthetic fluid, and install high-friction ceramic pads.",
    features: [
      "Digital rotor runout & thickness gauge test",
      "Caliper alignment & piston lube",
      "High-temp DOT fluid flush & pressure bleed",
      "Performance pad upgrades (Lyndall / EBC / Brembo)",
      "Stainless braided line installation"
    ],
    estimatedTime: "2 - 4 Hours",
    startingPrice: "$140",
    iconName: "ShieldAlert"
  },
  {
    id: "oil-fluid-changes",
    title: "Oil & Fluid Services",
    category: "maintenance",
    shortDesc: "Full synthetic 3-hole fluid service: engine, primary chaincase, and heavy-duty transmission.",
    fullDesc: "Regular fluid maintenance with premium synthetic V-Twin lubricants extends powertrain life under Texas summer heat and hard riding conditions. Includes magnetic drain plug inspection for metal shavings.",
    features: [
      "Full synthetic 20W-50 V-Twin engine oil change",
      "Primary chaincase fluid change & chain tensioning",
      "Transmission fluid flush with heavy-duty 75W-140 gear lube",
      "Magnetic drain plug metal debris audit",
      "High-flow chrome/black filter replacement & O-rings"
    ],
    estimatedTime: "1 Hour",
    startingPrice: "$220 (Full 3-Hole Synthetic)",
    iconName: "Droplet"
  },
  {
    id: "parts-fabrication",
    title: "Custom Parts & Fabrication",
    category: "custom",
    shortDesc: "TIG welding, custom frame gussets, motor mount reinforcement, and custom bracketry.",
    fullDesc: "When off-the-shelf parts don't fit or custom frame modification is required, we fabricate heavy-duty brackets, stabilizer mounts, and frame reinforcements in-house.",
    features: [
      "Precision TIG welding (Steel / Chromoly / Aluminum)",
      "Custom motor & transmission mount fabrication",
      "Frame neck stretch & rake modifications",
      "Reinforced swingarm gusseting",
      "Exhaust & fender bracket fabrication"
    ],
    estimatedTime: "Custom Schedule",
    startingPrice: "$165 / hr (Quote on Project)",
    iconName: "Wrench"
  },
  {
    id: "general-repair",
    title: "General Repair & Maintenance",
    category: "maintenance",
    shortDesc: "Comprehensive bike health inspection, drive belt adjustment, and general tuning.",
    fullDesc: "From pre-season safety checks to troubleshooting electrical or mechanical glitches, Paul applies 30+ years of mechanical mastery to keep your bike in peak road-ready shape.",
    features: [
      "50-Point chassis & safety audit",
      "Final drive belt/chain tension & tracking",
      "Charging system & battery load test",
      "Throttle cable & hydraulic clutch adjustment",
      "Full road-test verification"
    ],
    estimatedTime: "1 Day",
    startingPrice: "$150 / hr",
    iconName: "Cog"
  }
];

export const WORK_PROJECTS: WorkProject[] = [
  {
    id: "proj-1",
    title: "2022 Harley-Davidson Road Glide Special",
    category: "powertrain",
    bikeModel: "Road Glide FLTRXS",
    year: "2022",
    imageUrl: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=1200",
    beforeAfterSpec: {
      laserDeviationBefore: "14.2 mm Rear-to-Front Offset",
      laserDeviationAfter: "0.0 mm Zero-Tolerance Parallel",
      keyFix: "Corrected high-speed rear bagger wobble at 75+ mph; aligned engine isolation mounts and rear swingarm axle."
    },
    description: "Rider reported severe rear-end sway during highway passing. After full laser scanning, we discovered the motor mounts were twisted 14mm out of parallel. Re-aligned powertrain and installed heavy-duty stabilizer."
  },
  {
    id: "proj-2",
    title: "Custom FXR Performance Chopper Build",
    category: "frame",
    bikeModel: "Custom FXR Chromoly Frame",
    year: "1994 / Custom",
    imageUrl: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&q=80&w=1200",
    beforeAfterSpec: {
      laserDeviationBefore: "Neck Twisted 3.5 Degrees Rake Deviation",
      laserDeviationAfter: "Restored to 30.0 Degree Spec",
      keyFix: "Straightened neck backbone after accident, TIG welded gussets, and set true 30-degree rake with 4.5\" trail."
    },
    description: "Classic FXR frame came in with a bent neck post-crash. Straightened on our hydraulic frame jig, verified backbone integrity, and installed custom gussets for 130HP Milwaukee-Eight swap."
  },
  {
    id: "proj-3",
    title: "2020 Indian Challenger Performance Bagger",
    category: "suspension",
    bikeModel: "Challenger Dark Horse",
    year: "2020",
    imageUrl: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&q=80&w=1200",
    beforeAfterSpec: {
      laserDeviationBefore: "Fork Stiction & Triple Tree Twisted 6mm",
      laserDeviationAfter: "Zero Stiction Smooth Fork Travel",
      keyFix: "Loosened, laser-aligned, and retorqued triple trees, set custom rider sag, installed Öhlins performance cartridges."
    },
    description: "Heavy cornering stiction in front forks caused harsh bump response. Re-aligned triple trees on laser jig and dialed in front & rear suspension for 250lb rider."
  },
  {
    id: "proj-4",
    title: "Milwaukee-Eight 117 Hydraulic Frame Jig Realignment",
    category: "frame",
    bikeModel: "Harley-Davidson M8 Performance Bagger",
    year: "2023 / Frame Straightening",
    imageUrl: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&q=80&w=1200",
    beforeAfterSpec: {
      laserDeviationBefore: "12.4 mm Frame Neck Twist Post-Collision",
      laserDeviationAfter: "0.0 mm True Factory Centerline",
      keyFix: "Secured on Paul's 360° hydraulic frame jig turntable; used dual pulling towers, frame clamps, and laser alignment arms to pull neck backbone straight."
    },
    description: "Heavy-duty Milwaukee-Eight 117 motorcycle mounted on Paul Hurey's custom 360-degree hydraulic frame turntable jig. Following a high-speed collision, backbone twist and fork stiction were measured with 3D laser scanners before pulling the frame back to zero-tolerance factory geometry."
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "rev-1",
    riderName: "Mark 'Big Mac' Sullivan",
    bikeInfo: "2021 Harley-Davidson Street Glide CVO",
    location: "Houston, TX",
    rating: 5,
    quote: "I took my CVO to two dealership service centers for a high-speed wobble above 70mph. Both told me 'that’s just bagger wind flex.' Paul at The Frame Shop put it on his laser jig, found the motor mount 11mm out of alignment, and fixed it in two days. The bike tracks like an arrow now at 90mph. Paul is a true master.",
    verifiedService: "Power Train Alignment & Laser Scan"
  },
  {
    id: "rev-2",
    riderName: "Dave R.",
    bikeInfo: "Custom 124ci Performance FXR",
    location: "Spring, TX",
    rating: 5,
    quote: "When you build a high-horsepower bike, you can’t trust guesswork. Paul knows frame geometry inside and out. He straightened my neck, aligned my swingarm, and gave me exact specs before and after. Honest, straight-shooter, and unmatched quality.",
    verifiedService: "Frame Repair & Neck Straightening"
  },
  {
    id: "rev-3",
    riderName: "Jason K.",
    bikeInfo: "2019 Harley Road Glide Special",
    location: "The Woodlands, TX",
    rating: 5,
    quote: "The Frame Shop is the only place I will ever let touch my bike's chassis or suspension. Paul treats your motorcycle like his own. Honest pricing, incredible attention to detail, and a guy who actually rides what he builds.",
    verifiedService: "Suspension Tuning & Brake Audit"
  }
];

export const FAQS = [
  {
    q: "How do I know if my motorcycle frame or powertrain is out of alignment?",
    a: "Common warning signs include: high-speed wobble or rear-end 'sway' above 65mph, the bike pulling to one side when letting go of handlebars, uneven rear tire wear, premature drive belt edge fraying, or unusual motor vibration after installing performance upgrades."
  },
  {
    q: "Why isn't a factory stock motorcycle frame always straight?",
    a: "Factory production tolerances allow small margins of error. When you add high-torque engines, upgraded suspension, or aggressive cornering, these minor offsets multiply. Additionally, minor tip-overs, pothole impacts, or engine removals frequently pull motor mounts and swingarms out of true alignment."
  },
  {
    q: "Do I need an appointment for service?",
    a: "Yes. Paul operates by appointment only to ensure every motorcycle receives undivided focus and zero-tolerance precision measurement without rush. You can book an appointment online or call (832) 628-5226."
  },
  {
    q: "What types of motorcycles do you work on?",
    a: "We specialize in Harley-Davidson (Baggers, FXRs, Dynas, Softails), Indian Motorcycles, Performance Cruisers, Custom Choppers, and Classic V-Twins. We also handle frame diagnostics for custom builds and crashed motorcycles."
  }
];
