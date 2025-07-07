import { BasketItem } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import useStore from '@/lib/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MinusIcon, PlusIcon, TrashIcon, ShoppingCartIcon } from 'lucide-react';

interface ShoppingCartProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShoppingCart = ({ isOpen, onClose }: ShoppingCartProps) => {
  const { 
    basket, 
    removeFromBasket, 
    updateBasketQuantity, 
    clearBasket, 
    getBasketSummary 
  } = useStore();

  const summary = getBasketSummary();

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    updateBasketQuantity(itemId, newQuantity);
  };

  const handleRemoveItem = (itemId: string) => {
    removeFromBasket(itemId);
  };

  const handleClearBasket = () => {
    if (window.confirm('Are you sure you want to clear your basket?')) {
      clearBasket();
    }
  };

  const handleCheckout = () => {
    alert('Checkout functionality would be implemented here!\n\nThis could integrate with Outpost\'s actual checkout system or provide order details for manual processing.');
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCartIcon className="h-5 w-5" />
            Shopping Cart
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {basket.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <ShoppingCartIcon className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground">
                Start adding cards to see them here!
              </p>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <ScrollArea className="flex-1 mt-6">
                <div className="space-y-4">
                  {basket.map((item: BasketItem) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">
                              {item.card.name}
                            </h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {item.card.collection}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {item.card.rarity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {item.condition.condition}
                              </Badge>
                              {item.card.foil && (
                                <Badge variant="secondary" className="text-xs">
                                  ✨ Foil
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-8 w-8 p-0"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="h-8 w-8 p-0"
                            >
                              <MinusIcon className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              disabled={item.quantity >= item.condition.stock}
                              className="h-8 w-8 p-0"
                            >
                              <PlusIcon className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <div className="text-right">
                            <div className="font-semibold text-foreground">
                              {formatPrice((item.condition.price * item.quantity) / 100)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatPrice(item.condition.price / 100)} each
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-2 text-xs text-muted-foreground">
                          Stock: {item.condition.stock} available ({item.condition.condition})
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              {/* Footer with summary and actions */}
              <div className="mt-6 space-y-4">
                <Separator />
                
                {/* Summary */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        {summary.totalItems} items ({summary.totalQuantity} cards)
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Subtotal
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-foreground">
                        Total
                      </span>
                      <span className="text-lg font-semibold text-foreground">
                        {summary.totalPriceFormatted}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="space-y-2">
                  <Button onClick={handleCheckout} className="w-full">
                    Proceed to Checkout
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleClearBasket}
                    className="w-full"
                  >
                    Clear Cart
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground text-center">
                  💡 This is a demo. Real checkout would integrate with Outpost's system.
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ShoppingCart; 