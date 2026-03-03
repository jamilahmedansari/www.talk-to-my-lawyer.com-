import { useState, useMemo } from "react";
import AppLayout from "@/components/shared/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Shield,
  Briefcase,
  User,
  Scale,
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const ROLE_CONFIG = {
  admin:      { label: "Super Admin", icon: <Shield className="w-3.5 h-3.5" />,   color: "text-red-700 bg-red-100"    },
  attorney:   { label: "Attorney",    icon: <Scale className="w-3.5 h-3.5" />,    color: "text-purple-700 bg-purple-100" },
  employee:   { label: "Affiliate",   icon: <Briefcase className="w-3.5 h-3.5" />, color: "text-blue-700 bg-blue-100"  },
  subscriber: { label: "Subscriber",  icon: <User className="w-3.5 h-3.5" />,     color: "text-green-700 bg-green-100" },
};

type Role = keyof typeof ROLE_CONFIG | "all";

const ROLE_TABS: { value: Role; label: string }[] = [
  { value: "all",        label: "All"        },
  { value: "subscriber", label: "Subscribers" },
  { value: "employee",   label: "Affiliates"  },
  { value: "attorney",   label: "Attorneys"   },
  { value: "admin",      label: "Admins"      },
];

export default function AdminUsers() {
  const [search, setSearch]     = useState("");
  const [roleTab, setRoleTab]   = useState<Role>("all");

  const { data: users, isLoading, refetch, isFetching } = trpc.admin.users.useQuery({});

  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated", { description: "The user's permissions have been changed." });
      refetch();
    },
    onError: (e) => toast.error("Role update failed", { description: e.message }),
  });

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchRole   = roleTab === "all" || u.role === roleTab;
      const q           = search.toLowerCase();
      const matchSearch = !q
        || (u.name ?? "").toLowerCase().includes(q)
        || (u.email ?? "").toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [users, roleTab, search]);

  // Role counts for tab badges
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users?.length ?? 0 };
    for (const u of users ?? []) c[u.role] = (c[u.role] ?? 0) + 1;
    return c;
  }, [users]);

  return (
    <AppLayout breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Users" }]}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              User Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} of {users?.length ?? 0} users shown
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Role Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRoleTab(tab.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${roleTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                ${roleTab === tab.value ? "bg-white/20" : "bg-background"}`}>
                {counts[tab.value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* User List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground text-sm">
              No users match your search.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((user) => {
              const roleInfo = ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.subscriber;
              const initials = (user.name ?? user.email ?? "U")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <Card key={user.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-semibold text-xs">{initials}</span>
                      </div>

                      {/* Name + Email + Badges */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">
                            {user.name ?? "Unnamed User"}
                          </p>
                          {/* Email verified badge */}
                          {(user as any).emailVerified ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full font-medium">
                              <CheckCircle className="w-2.5 h-2.5" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">
                              <XCircle className="w-2.5 h-2.5" /> Unverified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email ?? "No email"}</p>
                      </div>

                      {/* Role badge + change selector */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Current role badge — hidden on very small screens */}
                        <span className={`hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleInfo.color}`}>
                          {roleInfo.icon}
                          {roleInfo.label}
                        </span>

                        <Select
                          value={user.role}
                          onValueChange={(newRole) => {
                            // Skip the mutation if the role hasn't actually changed
                            if (newRole === user.role) return;
                            updateRole.mutate({ userId: user.id, role: newRole as any });
                          }}
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="w-28 sm:w-32 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="subscriber">Subscriber</SelectItem>
                            <SelectItem value="employee">Affiliate</SelectItem>
                            <SelectItem value="attorney">Attorney</SelectItem>
                            <SelectItem value="admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
