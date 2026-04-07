import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, ShoppingBag, Send, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Order {
  _id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  paymentMethod: string;
  status: string;
  amount: number;
  currency: string;
  accountSize: string;
  itemCount: number;
  discordUserId: string | null;
  discordUsername: string | null;
  createdAt: string;
  _raw?: Record<string, unknown>;
}

export const DiscordOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [showRaw, setShowRaw] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pushedIds, setPushedIds] = useState<Set<string>>(new Set());
  const pageSize = 25;

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-orders", {
        body: { limit: pageSize, skip: page * pageSize },
      });
      if (error) throw error;
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to fetch orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (d: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d;
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    if (!amount) return "—";
    if (currency === "INR") return `₹${amount.toLocaleString()}`;
    if (currency === "USD") return `$${amount.toLocaleString()}`;
    return `${amount.toLocaleString()} ${currency}`;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "confirmed" || s === "completed" || s === "paid" || s === "fulfilled") {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{status}</Badge>;
    }
    if (s === "pending" || s === "processing") {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{status}</Badge>;
    }
    if (s === "cancelled" || s === "failed" || s === "refunded") {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{status}</Badge>;
    }
    return <Badge variant="outline">{status || "—"}</Badge>;
  };

  const getAccountSize = (order: Order): string => {
    return order.accountSize || "—";
  };

  const handlePushToDiscord = async (order: Order) => {
    setPushingId(order._id);
    try {
      const { data, error } = await supabase.functions.invoke("fake-cert-announce", {
        body: {
          action: "order_confirm",
          customer_name: order.customerName,
          account_size: getAccountSize(order),
          payment_method: order.paymentMethod,
          order_number: order.orderNumber,
          amount: order.amount,
          email: order.email,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPushedIds(prev => new Set(prev).add(order._id));
      toast({ title: "Sent!", description: `Order confirmation pushed to Discord for ${order.customerName}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to push", variant: "destructive" });
    } finally {
      setPushingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Discord Orders</h2>
          <p className="text-muted-foreground">Recent orders from the database ({total} total)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? "Hide Raw" : "Debug Schema"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {showRaw && orders.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-400">Raw Field Keys (first order)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
              {JSON.stringify(orders[0]._raw, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingBag className="w-10 h-10 mb-3 opacity-40" />
              <p>No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Discord</TableHead>
                    <TableHead>Account Size</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Push</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order._id}>
                      <TableCell className="font-mono text-xs">{order.orderNumber || "—"}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{order.customerName || "—"}</p>
                          {order.email && (
                            <p className="text-xs text-muted-foreground">{order.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.discordUserId ? (
                          <div>
                            <p className="text-xs font-medium text-foreground">{order.discordUsername || "—"}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{order.discordUserId}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{getAccountSize(order)}</TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{order.paymentMethod || "—"}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="font-medium">
                        {formatAmount(order.amount, order.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.status.toLowerCase() === "pending" ? (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        ) : pushedIds.has(order._id) ? (
                          <Check className="w-4 h-4 text-emerald-400 ml-auto" />
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePushToDiscord(order)}
                            disabled={pushingId === order._id}
                            className="h-7 px-2 text-xs"
                            title="Push order to Discord"
                          >
                            {pushingId === order._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
