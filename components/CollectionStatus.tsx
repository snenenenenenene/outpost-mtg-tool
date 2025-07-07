import { useMemo } from 'react';
import useStore from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { DatabaseIcon, CheckCircleIcon, PackageIcon, TrendingUpIcon } from 'lucide-react';

export default function CollectionStatus() {
  const { outpostData, lastDataRefresh } = useStore();

  const collectionStats = useMemo(() => {
    const stats: Record<string, { count: number; available: number; totalStock: number }> = {};
    
    outpostData.forEach(card => {
      if (!stats[card.collection]) {
        stats[card.collection] = { count: 0, available: 0, totalStock: 0 };
      }
      stats[card.collection].count++;
      
      // Safety check for conditions
      if (card.conditions && card.conditions.length > 0) {
        stats[card.collection].totalStock += card.conditions.reduce((sum, c) => sum + c.stock, 0);
        if (card.conditions.some(c => c.stock > 0)) {
          stats[card.collection].available++;
        }
      }
    });
    
    return Object.entries(stats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([collection, data]) => ({ collection, ...data }));
  }, [outpostData]);

  const totalAvailable = outpostData.filter(card => 
    card.conditions && card.conditions.length > 0 && card.conditions.some(c => c.stock > 0)
  ).length;
  const totalStock = outpostData.reduce((sum, card) => {
    if (card.conditions && card.conditions.length > 0) {
      return sum + card.conditions.reduce((cardSum, c) => cardSum + c.stock, 0);
    }
    return sum;
  }, 0);
  const averagePrice = outpostData.reduce((sum, card) => {
    if (card.conditions && card.conditions.length > 0) {
      const minPrice = Math.min(...card.conditions.map(c => c.price));
      return sum + minPrice;
    }
    return sum;
  }, 0) / outpostData.length / 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="h-5 w-5" />
              Collection Coverage
            </CardTitle>
            {lastDataRefresh && (
              <Badge variant="outline">
                Last updated: {formatDate(lastDataRefresh)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <DatabaseIcon className="h-5 w-5 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-700">{outpostData.length}</div>
                </div>
                <div className="text-sm text-blue-600">Total Unique Cards</div>
              </CardContent>
            </Card>
            
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  <div className="text-2xl font-bold text-green-700">{totalAvailable}</div>
                </div>
                <div className="text-sm text-green-600">Cards Available</div>
              </CardContent>
            </Card>
            
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <PackageIcon className="h-5 w-5 text-purple-600" />
                  <div className="text-2xl font-bold text-purple-700">{totalStock}</div>
                </div>
                <div className="text-sm text-purple-600">Total Stock</div>
              </CardContent>
            </Card>
            
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUpIcon className="h-5 w-5 text-orange-600" />
                  <div className="text-2xl font-bold text-orange-700">€{averagePrice.toFixed(2)}</div>
                </div>
                <div className="text-sm text-orange-600">Average Price</div>
              </CardContent>
            </Card>
          </div>

          {/* Current Collections */}
          <Card>
            <CardHeader>
              <CardTitle>Current Collections ({collectionStats.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collection</TableHead>
                    <TableHead className="text-right">Total Cards</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Total Stock</TableHead>
                    <TableHead className="text-right">Availability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collectionStats.map(({ collection, count, available, totalStock }) => {
                    const availabilityPercent = Math.round((available / count) * 100);
                    return (
                      <TableRow key={collection}>
                        <TableCell className="font-medium">{collection}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                        <TableCell className="text-right">{available}</TableCell>
                        <TableCell className="text-right">{totalStock}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={availabilityPercent} 
                              className="w-16 h-2"
                            />
                            <Badge
                              variant={
                                availabilityPercent > 50 
                                  ? 'default' 
                                  : availabilityPercent > 20
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {availabilityPercent}%
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Scraping Information */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>Scraping Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Coverage:</span>
                  <span className="text-muted-foreground">Comprehensive dataset</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Total Collections Available:</span>
                  <span className="text-muted-foreground">697+ collections</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Collections Processed:</span>
                  <span className="text-muted-foreground">{collectionStats.length} collections</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Cards per Collection:</span>
                  <span className="text-muted-foreground">All available cards</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Update Strategy:</span>
                  <span className="text-muted-foreground">Complete inventory scraping</span>
                </div>
              </div>
              
              <Card className="mt-4 bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="text-sm text-blue-800">
                    <strong>Note:</strong> This data represents a comprehensive scraping of Outpost's MTG inventory. 
                    The system processes all available collections while respecting server limits and includes 
                    condition-specific pricing and stock information.
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
} 