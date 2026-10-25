export const GROOMPRO_MODULES=[
 {code:"CALENDAR",name:"Calendar",description:"Appointments and the primary scheduling workspace."},
 {code:"CUSTOMERS",name:"Customers",description:"Customer profiles, contacts, addresses, and history."},
 {code:"PETS",name:"Pets",description:"Pet profiles, grooming details, and records."},
 {code:"TICKETS",name:"Tickets & Appointments",description:"The central ticket/appointment workflow."},
 {code:"WHITEBOARD",name:"Whiteboard",description:"Touch-first grooming-floor operations display."},
 {code:"MESSAGING",name:"Messaging",description:"Customer communications and reminders."},
 {code:"INVENTORY",name:"Inventory",description:"Products, stock, and inventory control."},
 {code:"REPORTS",name:"Reports",description:"Business and operational reporting."},
 {code:"ONLINE_BOOKING",name:"Online Booking",description:"Customer-facing online appointment booking."},
 {code:"DAYCARE",name:"Daycare",description:"Daycare workflow and attendance."},
 {code:"BOARDING",name:"Boarding",description:"Boarding reservations and operations."},
] as const;
export const MODULE_CODE_BY_NAME=Object.fromEntries(GROOMPRO_MODULES.map(m=>[m.name,m.code])) as Record<string,string>;

// Workspace names and their feature ownership live here, beside the feature catalog.
export const WORKSPACE_MODULES=["Calendar","Customers","Pets","Tickets","Whiteboard","Messaging","Inventory","Reports","Services","Products","Packages","VIP Memberships","Schedule","Settings"] as const;
export const WORKSPACE_FEATURES:Record<string,string>={Calendar:'CALENDAR',Customers:'CUSTOMERS',Pets:'PETS',Tickets:'TICKETS',Whiteboard:'WHITEBOARD',Messaging:'MESSAGING',Inventory:'INVENTORY',Reports:'REPORTS',Services:'TICKETS',Products:'INVENTORY',Packages:'TICKETS','VIP Memberships':'TICKETS',Schedule:'CALENDAR'};
// Always reachable: Calendar and setup/catalog entry points. Server policy still
// enforces explicit module restrictions; absent configuration never hides them.
export const ALWAYS_VISIBLE_WORKSPACES=new Set(['Calendar','Settings','Services','Products','Packages','VIP Memberships','Schedule']);
