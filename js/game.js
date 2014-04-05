
;( function() {
	"use strict"
} )()

var can = document.getElementById("canvas")
var ctx = can.getContext("2d")

const clog = console.log











/*
	Contract functions.

	Return a value if it meets criteria, otherwise throws an error.
*/

const always = ( function () {

	const checkThat = (predicate, type) => {
		return val => {
			if (predicate(val)) {
				return val
			} else {
				throw new TypeError(
					"The contract always." + type + " was broken with the value " + val + ".\n" +
					"Calling function was " + arguments.callee.caller.toString() + ".\n")
			}
		}
	}

	return {
		'whole':
			checkThat(val => {
				return val === val && val % 1 === 0
			}, 'whole'),
		'numeric':
			checkThat(val => {
				return val === val
			}, 'numeric'),
		'boolean':
			checkThat(val => {
				return val === false || val === true
			}, 'boolean'),
		'func':
			checkThat(val => {
				return val && typeof val === 'function'
			}, 'function')
	}

} )()










const constants = ( function () {

	var self = {}

	self.frameTime    = 1000 / 60

	self.pixelDx      = -1.4                        // the change in the x position of scrolling elements.
	self.flyingBirdDx = 0.75                        // the change in x position of the flying bird.
	self.epsilon      = 0.00000001                  // a very small number, for use in numeric derivatives.

	self.cloudWidth   = 140                         // the pixel width of each cloud.
	self.cloudHeight  = 140 / Math.pow(1.618, 3)    // the pixel height of each cloud.

	self.gravity      = 9.81 / 60                   // the gravitational acceleration.

	self.colours = {
		blue: "#3498db",
		white: "#ecf0f1",
		black: "black"
	}

	self.heroWidth    = 32                          // .
	self.heroHeight   = 32                          //

	self.bound =  {
		x0: -self.cloudWidth,                       // the left outer bound.
		x1: can.width + self.cloudWidth,            // the right outer bound.
		y0: -50,                                    // the top of the screen.
		y1: can.height + 50,                        // the bottom of the screen.
	}


	self.score = {
		x: 100,                                     // the x position of the score number.
		y: 50                                       // the y position of the score number.
	}

	self.cloudRange = {
		x: 0.150,
		y: 0.875
	}

	return self

} )()










const utils = ( function () {

	var self = {}

	self.getTime = () => {
		return (new Date).getTime()
	}

	self.isEmpty = obj => {
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				return false
			}
		}
		return true
	}

	self.randBetween = (lower, upper) => {
		return always.numeric((Math.random() * (upper-lower)) + lower)
	}

	self.flatmap = (coll, fn) => {

		var out = []

		for (var ith = 0; ith < coll.length; ith++) {
			out = out.concat( fn(coll[ith]) )
		}

		return out
	}

	self.asCanvasMouseCoords =
		(x, y) => {
			return {
				x: always.numeric(x - can.offsetLeft),
				y: always.numeric(y - can.offsetTop)
			}
		}

	return self

} )()









/*
	motion

	closed function of time, that describe the position
*/

const motion = ( function () {

	const flying  = self => {
		return (step, reflect = false) => {

			if (reflect) {
				return self
			}

			self.vx   = self.vx
			self.vy   = self.vy
			self.init = self.init

			const dt = step - self.init
			const dy = 7 * Math.sin(step / 30)

			const x0 = self.x0 + (self.vx * dt)
			const x1 = self.x1 + (self.vx * dt)

			const y0 = self.y0 + dy
			const y1 = self.y1 + dy

			return {
				x0: x0,	x1: x1,
				y0: y0,	y1: y1
			}

		}
	}

	const falling = self => {
		return (step, reflect = false) => {

			if (reflect) {
				return self
			}

			// add default arguments.

			self.vx = self.vx
			self.vy = self.vy

			self.ax = self.ax
			self.ay = self.ay

			const dt = step - self.init

			const x0 = self.x0 + (self.vx * dt) + (0.5 * self.ax * (dt * dt))
			const x1 = self.x1 + (self.vx * dt) + (0.5 * self.ax * (dt * dt))

			const y0 = self.y0 + (self.vy * dt) + (0.5 * self.ay * (dt * dt))
			const y1 = self.y1 + (self.vy * dt) + (0.5 * self.ay * (dt * dt))

			return {
				x0: x0,	x1: x1,
				y0: y0,	y1: y1
			}
		}
	}

	/* ----------------- Unit Tests ----------------- */

	const assert = console.assert

	const leftMotion = falling({
		x0: 0, x1: 0,
		y0: 0, y1: 0,

		vx: -1, init: 0
	})

	for (var ith = 0; ith < 100; ith++) {

		var pos = leftMotion(ith)
		assert(pos.x0 === -ith)
	}

	return {
		falling: falling,
		flying: flying
	}

} )()











// the initial state

state = ( function () {

	var self = {}

	self.hero = {
		position: motion.flying({
			x0: 10,
			x1: 10 + constants.heroWidth,

			y0: constants.cloudRange.y + 50,
			y1: constants.cloudRange.y + 50 + constants.heroHeight,

			vx: constants.flyingBirdDx,
			vy: 0,

			init: 0
		}),
		isDead:      false,
		locomotion:  "flying",
		lastCloud:   -1,
		jump:   {}
	}

	self.clouds     = []
	self.reactions  = []
	self.collisions = {}

	self.score      = 0
	self.nextScore  = 0
	self.nextCloud  = 0
	self.currStep   = 1

	return self

} )()










/*
	React

	This module returns 'setters' for the game state. Each function
	herein takes a part of the game state, and modifies it. They don't usually
	test if the state should be modified - that task falls on update and currently.
*/
const react = ( function () {

	var self = {}

	const makeReaction = (gets, sets, reaction) => {
		/*
		creates a reaction function that accesses and alters part
		of the state.
		*/

		return state => {

			const visible = gets.map(prop => state[prop])
			const transformed = reaction.apply(null, visible)

			for (var prop of sets) {
				state[prop] = transformed[prop]
			}
			return state
		}
	}

	self.addClouds = makeReaction(
		['clouds', 'currStep', 'nextCloud'], ['clouds', 'nextCloud'],
		(clouds, currStep, nextCloud) => {
			/*
			Add a new cloud.
			*/

			const y0 = utils.randBetween(
				0.150 * constants.bound.y1 - constants.heroHeight - 10,
				0.875 * constants.bound.y1)

			const y1 = y0 + constants.cloudHeight

			const newCloud = {
				position: motion.falling({
					x0: constants.bound.x1,
					x1: constants.bound.x1 + constants.cloudWidth,
					y0: y0,
					y1: y1,

				vx: constants.pixelDx,
					vy: 0,

					ax: 0,
					ay: 0,

					init: currStep
				}),
				cloudId: nextCloud
			}

			return {
				clouds: clouds.concat([newCloud]),
				nextCloud: nextCloud + 1
			}
		})

	self.removeOldClouds = makeReaction(
		['clouds', 'currStep'], ['clouds'],
		(clouds, currStep) => {
			/*
			Remove the clouds that drift off-screen.
			*/

			const filteredClouds = clouds.filter(cloud => {
				return always.boolean(cloud.position(currStep).x0 > constants.bound.x0)
			})

			return {
				clouds: filteredClouds
			}
		}
	)

	self.clipWings = makeReaction(
		['hero', 'currStep'], ['hero'],
		(hero, currStep) => {
			/*
			Swap the initial flying sin-wave motion function for a
			falling motion function.
			*/

			if (hero.locomotion === "flying") {
				hero.locomotion = 'falling'

				const coords = hero.position(currStep)

				const ySlope = ( function () {

					const coords1 = hero.position(currStep + constants.epsilon)

					return (coords.y1 - coords1.y1) / (coords.x1 - coords1.x1)
				} )()

				hero.position = always.func( motion.falling({
					x0: coords.x0,
					x1: coords.x1,
					y0: coords.y0,
					y1: coords.y1,

					vx: constants.birdDx,
					vy: ySlope,

					ax: 0,
					ay: constants.gravity,

					init: currStep
				}) )
			}

			state.hero = hero

			return state

		}
	)

	self.enqueueCollisions = state => {
			/*
			Every moving object in the game has a trajectory function.
			Because of this collisions can easily be found before they happen;
			the player trajectory function and each cloud trajectory function can
			be used to checked to see if they intersect at any point.

			If an interection between the player and cloud is found in the future,
			then the player either rebounds (1.), lands on the platform (2.), or


			1, Rebounds. The x component of the birds velocity is reversed.
			2, Lands. The y component of the acceleration and velocities are set
				to zero, and the x component is set to the scroll speed dx.
			3, Falls into oblivion. The trajectory is kept.
			*/

			/*
				for each cloud:
					find the t' that the trajectory shares the same y position as the cloud
					using the quadratic equation.

					If t' isnt in the right range next.

					get the [x0, x1, y0, y1 of the function at this time.
					if


					.5 at ^2 + vt- constant = 0


			*/

		return state
	}

	self.alterCourse = makeReaction(
		['hero', 'collisions', 'score'], ['hero', 'collisions', 'score'],
		(hero, collisions, score) => {
			/*
			The pre-calculated collision point has
			been reached, so we need to swap out
			the current player's motion function forst
			the pre-computed motion function.
			*/

			hero.position   = collision.position
			hero.locomotion = collision.locomotion

			if (hero.lastCloud !== collision.cloudId) {
				score += 1
				hero.lastCloud = collision.cloudId
			}

			return {
				hero: hero,
				collisions: [],
				score: score
			}
		}
	)

	self.endGame = makeReaction(
		['hero'], ['hero'],
		(hero) => {
			/*
			The game is over.
			*/

			hero.isDead = true
			return {hero: hero}
		}
	)

	self.beginJumpPowerup = time => {
		return makeReaction(
			['hero'], ['hero'],
			(hero) => {
				/*
				register that we are getting ready to jump.
				*/

				if (hero.locomotion === 'standing' || hero.locomotion === "falling") {
					hero.jump = {
						'time': time
					}
				}

				return {hero: hero}
			}
		)
	}

	self.takeOff = (x, y, time) => {
		return state => {

			var hero = state.hero

			if (hero.locomotion !== "standing") {
				return state
			}

			const holdDuration = time - hero.jump.time

			const heroCoords = hero.position(state.currStep)

			var mouse = utils.asCanvasMouseCoords(x, y)

			var dist = {
				x: Math.abs(always.numeric(mouse.x - heroCoords.x1)),
				y: -Math.abs(always.numeric(mouse.y - heroCoords.y1))
			}

			var angle = Math.atan(dist.y / dist.x)

			var velocities = {
				x:
					Math.min((holdDuration * Math.cos(angle)) / 30, 11),
				y:
					Math.min((holdDuration * Math.sin(angle)) / 30, 11)
			}

			hero.position = motion.falling({
				x0: heroCoords.x0,
				x1: heroCoords.x1,
				y0: heroCoords.y0,
				y1: heroCoords.y1,

				vx: always.numeric(velocities.x),
				vy: always.numeric(velocities.y),

				ax: 0,
				ay: constants.gravity,

				init: always.whole(state.currStep)
			})

			hero.locomotion = 'falling'
			hero.jump = {}

			state.hero = hero

			return state
		}
	}

	self.setAngle = (x, y) => {
		return state => {

			var hero = state.hero
			const mouse = utils.asCanvasMouseCoords(x, y)
			const heroCoords = hero.position(state.currStep)

			var dist = {
				x: always.numeric(mouse.x - heroCoords.x1),
				y: always.numeric(mouse.y - heroCoords.y1)
			}

			if (dist.y === 0) {
				var angle = 0
			} else {
				var angle = -Math.atan2(dist.x, dist.y) - (270) * 3.14/180
			}

			hero.angle = angle
			state.hero = hero

			return state
		}
	}

	return self

})()

const currently = ( function () {
	/*
		This module returns predicates that inspect the
		current state. These are currently used in the drawing
		and updating modules.
	*/

	return {
		isCloudy:
			state => {
				return state.clouds.length > 0
			},
		noFutureCollisions:
			state => {
				return utils.isEmpty(state.collisions)
			},
		cloudIsReady:
			state => {
				return state.currStep % 100 === 0
			},
		offscreen:
			state => {

				const coords = state.hero.position( state.currStep )

				const isOffscreen = coords.y1 > constants.bound.y1 ||
					coords.x0 < constants.bound.x0 ||
					coords.x1 > constants.bound.x1

				return isOffscreen
			},
		flying:
			state => {
				return state.hero.locomotion === 'flying'
			},
		falling:
			state => {
				return state.hero.locomotion === 'falling'
			},
		notFalling:
			state => {
				return state.hero.locomotion !== 'falling'
			},

		colliding:
			state => {
				return !utils.isEmpty(state.collisions) && state.collisions.step <= state.currStep
			},

		isDead:
			state => {
				return state.hero.isDead
			},
		isAlive:
			state => {
				return !state.hero.isDead
			}
	}

} )()

var update = ( function () {
	/*
		This module returns a function that - given the
		game state at state.currStep - returns the state at state.currStep + 1
	*/

	return state => {

		const when = (condition, reaction) => {
			// side-effectfully update state

			if (condition(state)) {
				state.reactions = state.reactions.concat([reaction])
			}
		}

		when(currently.cloudIsReady, react.addClouds)

		when(currently.isCloudy, react.removeOldClouds)

		when(currently.offscreen, react.endGame)

		when(currently.noFutureCollisions, react.enqueueCollisions)

		when(currently.colliding, react.alterCourse)

		/*
			consume every event in the queue, in order.
		*/

		for (var ith = 0; ith < state.reactions.length; ith++) {
			var reaction = state.reactions[ith]

			if (reaction) {
				state = always.func(reaction)(state)
			}
		}

		state.reactions = []
		state.currStep = always.whole(state.currStep + 1)

		return state
	}

} )()











const draw = ( function () {
	/*
		This module returns a function that handles all canvas
		drawing for the game.
	*/

	const render = {
		cloud:
			state => {

				ctx.fillStyle = constants.colours.white

				state.clouds.forEach(cloud => {

					var coords = cloud.position(state.currStep)

					ctx.fillRect(coords.x0, coords.y0, constants.cloudWidth, constants.cloudHeight)
				})
			},
		hero:
			state => {

				const hero = state.hero
				const birdy = document.getElementById("bird-asset")

				if (hero.jump.time) {
					ctx.fillStyle = constants.colours.black
				} else {
					ctx.fillStyle = constants.colours.white
				}

				const coords = hero.position(state.currStep)

				if (hero.locomotion === "standing") {

					var angle = hero.angle

				} else {

					const coords1 = hero.position(state.currStep + 0.01)

					const dist = {
						x: coords.x0 - coords1.x0,
						y: coords.y0 - coords1.y0
					}

					if (dist.y === 0) {
						var angle = 0
					} else {
						var angle = -Math.atan2(dist.x, dist.y) + (270) * 3.14/180
					}
				}

				coordsPrime = {
					x0:  Math.cos(angle) * coords.x0 + Math.sin(angle) * coords.y0,
					y0: -Math.sin(angle) * coords.x0 + Math.cos(angle) * coords.y0
				}

				coordsPrime.x0 -= 5
				coordsPrime.y0 -= 3

				ctx.save();

				ctx.rotate(angle)

				ctx.drawImage(birdy, coordsPrime.x0, coordsPrime.y0)
				ctx.restore();

				ctx.fillStyle = 'rgba(0,0,0,0.3)'
				ctx.fillRect(
					coords.x0, coords.y0,
					constants.heroWidth, constants.heroHeight
				)
			},
		score:
			state => {
				// draw the score to the corner of the screen.

				ctx.font = "30px Monospace"

				ctx.fillText(
					state.score + "",
					constants.score.x, constants.score.y)

				ctx.fillText(
					state.currStep + "",
					constants.score.x, constants.score.y + 100)

			},
		deathScreen:
			state => {

				ctx.fillStyle = 'rgba(0,0,0,0.6)'

				ctx.fillRect(
					constants.bound.x, constants.bound.y,
					constants.bound.x, constants.bound.y)

				ctx.fillStyle = constants.colours.blue

				ctx.fillRect(
					constants.bound.x0, 200,
					constants.bound.x1, 100)

				ctx.font = "20px Monospace"

				ctx.fillStyle = constants.colours.white

				value = state.score

				ctx.fillText(
					"You ran out of cluck. " +
					"Score: " + state.score,
					constants.score.x, 265)

			}
	}

	return state => {

		const when = (condition, reaction) => {
			// side-effectfully update state.

			if (condition(state)) {
				reaction(state)
			}
		}
		can.width = can.width

		when(currently.isCloudy, render.cloud)
		when(currently.isDead, render.deathScreen)
		when(currently.isAlive, render.score)
		when(currently.isAlive, render.hero)
	}

} )()










;( function () {
	/*
		This module attaches event listeners to the canvas.
	*/

	const upon = function (event, response) {
		//

		can.addEventListener(event, event => {
			state.reactions = state.reactions.concat([ response(event) ])
		})
	}

	upon('mousedown', event => {

		if (state.hero.locomotion === "flying") {
			return react.clipWings
		} else {
			return react.beginJumpPowerup(utils.getTime())
		}
	})

	upon('mouseup', event => {

		return react.takeOff(
			event.pageX, event.pageY, utils.getTime())
	})

	upon('mousemove', event => {
		return react.setAngle(event.pageX, event.pageY)
	})

} )()










;( function () {
	/*
		This module contains the main game loop, and
		the code that ends the game.
	*/

	const loop = function () {
		/*
			repeatedly update the state.
		*/

		if (!state.hero.isDead) {
			state = update(state);
			draw(state)
		} else {
			clearInterval(GAMEID)
		}
	}

	const GAMEID = setInterval(loop, 1000 / 60)

} )()
