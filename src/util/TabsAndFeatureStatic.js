export const tabFeatureConfig = [
  {
    tab_number: 1,
    tab_unique_name: "DASHBOARD",
    tab_name: "Dashboard",
    tab_path: "/dashboard",
    features: [
      { feature_unique_name: "VIEW_DASHBOARD", feature_name: "View Dashboard" },
    ],
  },
  {
    tab_number: 2,
    tab_unique_name: "APPOINTMENT",
    tab_name: "Appointment",
    tab_path: "/appointments",
    features: [
      {
        feature_unique_name: "VIEW_APPOINTMENTS",
        feature_name: "View Appointments",
      },
      {
        feature_unique_name: "VIEW_CLIENT_MOBILE",
        feature_name: "View Client Mobile Number",
      },
      {
        feature_unique_name: "ADD_APPOINTMENT",
        feature_name: "Add Appointment",
      },
      {
        feature_unique_name: "EDIT_APPOINTMENT",
        feature_name: "Edit Appointment",
      },
      {
        feature_unique_name: "DELETE_APPOINTMENT",
        feature_name: "Delete Appointment",
      },
      {
        feature_unique_name: "ADD_PAST_APPOINTMENT",
        feature_name: "Add Past Appointment",
      },

    ],
  },
  {
    tab_number: 3,
    tab_unique_name: "REMINDER",
    tab_name: "Reminders",
    tab_path: "/reminders",
    features: [
      {
        feature_unique_name: "VIEW_REMINDERS",
        feature_name: "View Reminders",
      },
      {
        feature_unique_name: "ADD_REMINDERS",
        feature_name: "Add Appointment",
      },
      {
        feature_unique_name: "UPDATE_REMINDER_ACTION",
        feature_name: "Reminder Action",
      },
      {
        feature_unique_name: "DELETE_REMINDER",
        feature_name: "Delete Reminder",
      },
    ],
  },
  {
    tab_number: 4,
    tab_unique_name: "CLIENT_LISTING",
    tab_name: "Clients",
    tab_path: "/clients",
    features: [
      { feature_unique_name: "VIEW_CLIENTS", feature_name: "View Clients" },
      { feature_unique_name: "ADD_CLIENT", feature_name: "Add Client" },
      { feature_unique_name: "EDIT_CLIENT", feature_name: "Edit Client" },
      { feature_unique_name: "DELETE_CLIENT", feature_name: "Delete Client" },
      { feature_unique_name: "VIEW_MOBILE", feature_name: "View Mobile" },
    ],
  },
  {
    tab_number: 5,
    tab_unique_name: "EMPLOYEE_MANAGEMENT",
    tab_name: "Employee",
    tab_path: "/employeeManagement",
    features: [
      { feature_unique_name: "VIEW_EMPLOYEES", feature_name: "View Employees" },
      { feature_unique_name: "ADD_EMPLOYEE", feature_name: "Add Employee" },
      { feature_unique_name: "EDIT_EMPLOYEE", feature_name: "Edit Employee" },
      {
        feature_unique_name: "CHANGE_EMP_ROLE",
        feature_name: "Change Employee Role",
      },
      {
        feature_unique_name: "DELETE_EMPLOYEE",
        feature_name: "Delete Employee",
      },
    ],
  },
  {
    tab_number: 6,
    tab_unique_name: "DOCTOR_MANAGEMENT",
    tab_name: "Doctors",
    tab_path: "/doctorManagement",
    features: [
      { feature_unique_name: "VIEW_DOCTORS", feature_name: "View Doctors" },
      { feature_unique_name: "ADD_DOCTOR", feature_name: "Add Doctor" },
      { feature_unique_name: "EDIT_DOCTOR", feature_name: "Edit Doctor" },
      { feature_unique_name: "DELETE_DOCTOR", feature_name: "Delete Doctor" },
    ],
  },

  {
    tab_number: 7,
    tab_unique_name: "SERVICE_MANAGEMENT",
    tab_name: "Services",
    tab_path: "/servicesManagement",
    features: [
      { feature_unique_name: "VIEW_SERVICES", feature_name: "View Services" },
      { feature_unique_name: "ADD_SERVICE", feature_name: "Add Service" },
      { feature_unique_name: "EDIT_SERVICE", feature_name: "Edit Service" },
      {
        feature_unique_name: "DELETE_SERVICE",
        feature_name: "Disable Service",
      },
    ],
  },
  {
    tab_number: 8,
    tab_unique_name: "RESOURCE_MANAGEMENT",
    tab_name: "Resources",
    tab_path: "/resourceManagement",
    features: [
      { feature_unique_name: "VIEW_RESOURCES", feature_name: "View Resources" },
      { feature_unique_name: "ADD_RESOURCE", feature_name: "Add Resource" },
      { feature_unique_name: "EDIT_RESOURCE", feature_name: "Edit Resource" },
      {
        feature_unique_name: "DELETE_RESOURCE",
        feature_name: "Delete Resource",
      },
    ],
  },
  {
    tab_number: 9,
    tab_unique_name: "BILLING",
    tab_name: "Billing",
    tab_path: "/billing",
    features: [
      { feature_unique_name: "VIEW_INVOICE", feature_name: "View Invoice" },
      { feature_unique_name: "VIEW_QUOTATION", feature_name: "View Quotation" },
      { feature_unique_name: "VIEW_RECEIPT", feature_name: "View Receipt" },
      { feature_unique_name: "CREATE_INVOICE", feature_name: "Create Invoice" },
      {
        feature_unique_name: "CREATE_QUOTATION",
        feature_name: "Create Quotation",
      },
      { feature_unique_name: "CREATE_RECEIPT", feature_name: "Create Receipt" },
      {
        feature_unique_name: "SAVE_AS_INVOICE",
        feature_name: "Save as Invoice",
      },
      { feature_unique_name: "PRINT_INVOICES", feature_name: "Print Invoices" },
      { feature_unique_name: "EDIT_QUOTATION", feature_name: "Edit Quotation" },
    ],
  },
  {
    tab_number: 10,
    tab_unique_name: "SETTINGS",
    tab_name: "Settings",
    tab_path: "/settings",
    features: [
      { feature_unique_name: "PROFILE_PAGE", feature_name: "Profile Page" },
      { feature_unique_name: "MANAGE_USERS", feature_name: "Manage Users" },
      {
        feature_unique_name: "SYSTEM_PREFERENCES",
        feature_name: "System Preferences",
      },
      {
        feature_unique_name: "ROLE_MANAGEMENT",
        feature_name: "Role Management",
      },
      {
        feature_unique_name: "CLIENT_CATEGORIES",
        feature_name: "Client Categories",
      },
      {
        feature_unique_name: "NOTIFICATION_CENTER",
        feature_name: "Notification Center",
      },
      {
        feature_unique_name: "ORGANIZATION_INFO",
        feature_name: "Organization Info",
      },
    ],
  },
    {
    tab_number: 11,
    tab_unique_name: "FEEDBACK_MANAGEMENT",
    tab_name: "Feedback",
    tab_path: "/feedbackManagement",
    features: [
      { feature_unique_name: "VIEW_FEEDBACK", feature_name: "View Feedback" },
      { feature_unique_name: "ADD_FEEDBACK", feature_name: "Add Feedback" },
    ],
  },
  {
    tab_number: 12,
    tab_unique_name: "LEADS_TRACKER",
    tab_name: "Leads Tracker",
    tab_path: "/leadsTracker",
    features: [
      { feature_unique_name: "VIEW_LEADS", feature_name: "View Leads" },
      { feature_unique_name: "VIEW_LEADS_MOBILE_NUMBER", feature_name: "View Lead Mobile Number" },
      { feature_unique_name: "EDIT_LEAD", feature_name: "Edit Lead" },
      { feature_unique_name: "DELETE_LEAD", feature_name: "Delete Lead" },
      { feature_unique_name: "VIEW_LEADS_STATUS", feature_name: "View Lead Status" },
      { feature_unique_name: "CHANGE_LEAD_STATUS", feature_name: "Change Lead Status" },
      { feature_unique_name: "EXPORT_LEADS", feature_name: "Export Leads" },
    ],
  },
];
