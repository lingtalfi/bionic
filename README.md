Bionic
===========
2017-11-20



Call your js functions using only html code.




Dependencies
================

bionic uses jquery.


The basic idea
===============

Basically, bionic is a declarative language to call your js functions using only html code.

The promise behind this idea is that templates don't need to know javascript 
to call your apis/js functions.

It also tends to factorize your js code in one place (your js api), and 
template writing becomes faster.




More reading
================
This idea started while I was creating the ekom module (an e-commerce module for my company).

The original idea you will find in the **doc/ekom-bionic.md** document of this repository.

You will also find the cheat sheet I use for development: **doc/bionic-cheatsheet.pdf**




How to
==========

You need to import the **bionic.js** script, then import another script which binds your
js api to bionic.


This is done via the **window.bionicActionHandler** function, which parameters are 
explained in the example's source code below.


Here is an excerpt of the one I'm currently using in ekom, I called it **ekom-bionic.js**,
and I call it just after the call to **bionic.js**.

```js

(function () {

    var api = ekomApi.inst(); // this is my js api, somewhere else on my server
    
    function devError(msg){
        alert("bionic error from ekom-bionic: " + msg);
        
    }
    
    
    /**
    * This is the function we want to override.
    * - jObj is the bionic element currently targeted.
    * - action is the value of the data-action parameter
    * - params is the params collected by the bionic library (see more details in the doc),
    *           basically those starting with data-param-
    * - take is a handy function that let you check for params existence
    *           (or use your own if you don't like it)
    * 
    */
    window.bionicActionHandler = function (jObj, action, params, take) {  

        //----------------------------------------
        // EKOM BIONIC SPECIFIC
        //----------------------------------------
        /**
         * @todo-ling: to externalize bionic, you need to import the code below
         * as a hook
         */
        /**
         * @todo-ling
         * Note: hookAfter system works, but maybe we don't need it.
         * If you go for it, don't forget to update the bionic documentation
         */
        switch (action) {
            //----------------------------------------
            // EKOM
            //----------------------------------------

            // cart
            //----------------------------------------
            case 'cart.addItem':
                var quantity = take('quantity', params);
                var productId = take('product_id', params);
                api.cart.addItem(quantity, productId, params);
                break;
            case 'cart.updateItemQuantity':
                var token = take('token', params);
                var newQuantity = take('quantity', params);
                api.cart.updateItemQuantity(token, newQuantity);
                break;
            case 'cart.removeItem':
                var token = take('token', params);
                api.cart.removeItem(token);
                break;

            // product box
            //----------------------------------------
            case 'product.getInfo':
                // hookAfter(jBionicElement, 'product.infoReady');
                var productId = take('product_id', params);
                var details = take('details', params, {});
                api.product.getInfo(productId, details);
                break;


            // user
            //----------------------------------------
            case 'user.addProductToWishlist':
                // hookAfter(jBionicElement, 'product.infoReady');
                var productId = take('product_id', params);
                api.user.addProductToWishlist(productId);
                break;

            //----------------------------------------
            // EKOM ESTIMATE CART
            //----------------------------------------
            case 'estimateCart.addItem':
                var quantity = take('quantity', params);
                var productId = take('product_id', params);
                api.ekomEstimateJsApi.cart.addItem(quantity, productId, params);
                break;
            case 'estimateCart.updateItemQuantity':
                var token = take('token', params);
                var newQuantity = take('quantity', params);
                api.ekomEstimateJsApi.cart.updateItemQuantity(token, newQuantity);
                break;
            case 'estimateCart.removeItem':
                var token = take('token', params);
                api.ekomEstimateJsApi.cart.removeItem(token);
                break;
            case 'estimateCart.ekomCart2EkomEstimateCart':
                api.ekomEstimateJsApi.cart.ekomCart2EkomEstimateCart();
                break;
            case 'estimateCart.ekomEstimateCart2EkomCart':
                api.ekomEstimateJsApi.cart.ekomEstimateCart2EkomCart();
                break;
            default:
                devError("Unknown action: " + action);
                console.log(params);
                break;

        }
    };
})();
```  




Recommendation
===================

Bionic was meant to be used along with ecp, a protocol for ajax communication.
And so I recommend that you also investigate into ecp.

- [Ecp](https://github.com/lingtalfi/Ecp): an ajax communication protocol for your app   




History Log
------------------
    
- 1.1.0 -- 2017-11-24

    - add form2param directive
    
- 1.0.1 -- 2017-11-24

    - fix actionFunction not distinguishing between identifiers

- 1.0.0 -- 2017-11-20

    - initial commit