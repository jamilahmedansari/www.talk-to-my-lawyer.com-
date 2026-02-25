import AppLayout from "@/components/shared/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Shield, Briefcase, User, Scale } from "lucide-react";
import { toast } from "sonner";

const ROLE_CONFIG = {
  admin: { label: "Super Admin", icon: <Shield className="w-3.5 h-3.5" />, color: "text-red-700 bg-red-100" },
  attorney: { label: "Attorney", icon: <Scale className="w-3.5 h-3.5" />, color: "text-purple-700 bg-purple-100" },
  employee: { label: "Affiliate", icon: <Briefcase className="w-3.5 h-3.5" />, color: "text-blue-700 bg-blue-100" },
  subscriber: { label: "Subscriber", icon: <User className="w-3.5 h-3.5" />, color: "text-green-700 bg-green-100" },
};

export default function AdminUsers() {
  const { data: users, isLoading, refetch } = trpc.admin.users.useQuery({});
  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: () => { toast.success("Role updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppLayout breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Users" }]}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">{users?.length ?? 0} registered users</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {(users ?? []).map((user) => {
              const roleInfo = ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.subscriber;
              return (
                <Card key={user.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-semibold text-sm">
                          {(user.name ?? user.email ?? "U")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{user.name ?? "Unnamed User"}</p>
                        <p className="text-xs text-muted-foreground">{user.email ?? "No email"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleInfo.color}`}>
                          {roleInfo.icon}
                          {roleInfo.label}
                        </span>
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => updateRole.mutate({ userId: user.id, role: newRole as any })}
                        >
                          <SelectTrigger className="w-32 h-7 text-xs">
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
