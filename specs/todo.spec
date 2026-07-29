# Todo Application

Einfache Beispiel-Spezifikation gegen die offizielle Playwright-TodoMVC-Demo
(https://demo.playwright.dev/todomvc). Jede Überschrift (##) ist ein
Szenario, jeder Bullet-Point (*) ist ein Step.

## Add a new todo item
* Open the todo app
* Add todo "Buy Milk"
* Todo "Buy Milk" should be visible

## Complete a todo item
* Open the todo app
* Add todo "Clean the house"
* Mark todo "Clean the house" as done
* Todo "Clean the house" should be marked as completed

## Delete new todo item
* Open the todo app
* Wait for "1" seconds
* Add todo "Buy Milk"
* Wait for "1" seconds
* Hover over todo "Buy Milk"
* Wait for "1" seconds
* Delete todo "Buy Milk"
* Wait for "1" seconds
* Todo "Buy Milk" should not be visible

## Add multiple todo items
* Open the todo app
* Add todos

   |description     |
   |-----------------|
   |Buy milk         |
   |Walk the dog     |
   |Clean the house  |

* Todo "Buy milk" should be visible
* Todo "Walk the dog" should be visible
* Todo "Clean the house" should be visible