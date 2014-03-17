
;( function() {
	"use strict"
} )()

var can = document.getElementById("canvas")
var ctx = can.getContext("2d")

const always = ( function () {
	/*
		Contract functions.
		Return a value if it meets criteria, otherwise throws an error.
	*/

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
	/*
		This module contains most of the arbitrary constants used
		in the game, including some translation functions.
	*/

	var self = {}

	self.step = 1

	self.dx = 3
	self.birdDx = 0.75
	self.epsilon = 0.000001

	self.cloudInterval = .3

	self.cloud = {
		width: 140,
		height: 140 / Math.pow(1.613, 3)
	}

	self.bounds = {
		x0: -self.cloud.width,
		x1: can.width + self.cloud.width,
		y0: -50,
		y1: can.height + 50,
	}

	self.gravity = 9.8 / 60,

	self.colours = {
		blue: "#3498db",
		white: "#ecf0f1",
		black: "black"
	}

	self.hero = {
		width: 32,
		height: 32
	}

	self.score = {
		x0: 100,
		y0: 50
	}
	self.frameTime =
		1 / 60

	self.asMagnitude =
		(interval) => {
			return 5.5  * Math.log(interval / 25)
		}

	self.asVelocity =
		velocity => {
			const terminalVelocity = 8

			if (velocity > 0) {
				return Math.min(velocity, terminalVelocity)
			} else {
				return Math.max(velocity, -terminalVelocity)
			}
		}

	self.cloudBounds = {
		y0: 0.150,
		y1: 0.875
	}

	/*
	Calculate how long the longest vertical jump will remain
	on screen. This determines how far into the future to check
	for collisions between a bird trajectory and platform.

	λt. vy.t + 0.5 * g * t^2

		derivative is

	λt. vy + g * t

	when the derivative is 0 the function is at its apex.
	For what t is the derivative 0?

	t_apex = -g / vy

	We need to find the velocity vy that gives the height of the canvas
	at its apex.

	h_apex = vy^2 / 2g

	Solving for vy WolframAlpha says we get

	|vy| = g^0.5 * (h)^0.5

	That currently gives us the time to the apex, and the value of vy that will
	precisely hit the apex. The final value we need is the time it takes to fall from
	the height h_apex to the ground given the gravity.

	vy_final = (2 g h_apex)^0.5

	t_falling = (vy_final - 0) / a

	t_total = t_apex + t_falling

	THE FINAL UNIT IS TIME STEPS, NOT SECONDS.
	*/

	// the launch velocity will just tip the top of the screen.
	const maxVelocity =
		Math.pow(self.gravity, 0.5) * Math.pow(self.bounds.y1, 0.5)

	// the time to the top of the screen from the bottom.
	const timeToApex = self.gravity / maxVelocity

	// the velocity reached after falling from the top to the bottom of the screen.
	const maximalFall = Math.pow((2 * self.gravity * self.bounds.y1), 0.5)

	// the time to the apex and back down.
	const totalTime = timeToApex + (maximalFall / self.gravity)

	self.maxJumpSteps = always.whole(Math.ceil(totalTime))

	return self
} )()

const utils = ( function () {

	var self = {}

	self.getTime = () => {
		return (new Date).getTime()
	}

	self.timer = interval => {

		const genesis = self.getTime()

		return function () {
			always.boolean(self.getTime() > (genesis + interval))
		}
	}

	self.trueWithOdds =	prob => {
		return always.numeric(Math.random() < prob)
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

	self.solve = (a, b, c) => {
		// solve an equation of the form at^2 + vt + c = 0

		const _ = undefined

		const match = (triplesList) => {
			/*
				Pattern match an array against a pattern array where
				undefined acts as a wildcard, and return the matching response.
			*/

			var matchedResponse;
			const args = Array.prototype.slice.call(arguments)

			for (var tripleIth = 0; tripleIth < args.length; tripleIth++) {

				var triple = args[tripleIth]

				const values   = triple[0]
				const pattern  = triple[1]
				const response = triple[2]

				var allMatches = true

				for (var ith = 0; ith < values.length; ith++) {
					allMatches = allMatches && (pattern[ith] === _ || values[ith] === pattern[ith])
				}

				if (allMatches) {
					return always.func(response)
				}
			}
		}

		const solver = match(
			[[a, b, c], [0, 0, 0], (a, b, c) => {
				// infinitely many solutions.
				return []
			}],
			[[a, b, c], [0, 0, _], (a, b, c) => {
				// no solutions solutions.
				return []
			}],

			[[a, b, c], [0, _, _], (a, b, c) => {
				// linear-equation.

				return [c / b, c / b]
			}],

			[[a, b, c], [_, 0, 0], (a, b, c) => {
				// only the second-order term.

				return [0]
			}],

			[[a, b, c], [_, _, _], (a, b, c) => {
				// the quadratic formula; the most general case.

				console.assert(a * b * c !== 0)

				const inner = Math.abs(b * b - 4 * a * c)
				const denominator = 2*a

				if (inner < 0) {
					return []
				} else {
					return [
						always.numeric((-b + Math.sqrt(inner)) / denominator),
						always.numeric((-b - Math.sqrt(inner)) / denominator)]
				}
			}]
		)

		always.numeric(a)
		always.numeric(b)
		always.numeric(c)

		return solver(a, b, c)
	}

	return self

} )()

const motion = ( function () {

	var self = {}

	self.flying = self => {
		return (step, reflect = false) => {
			/*

			*/
			if (reflect) {
				return self
			} else {
				return {
					x0: always.numeric(self.x0 + self.vx*step),
					x1: always.numeric(self.x1 + self.vx*step),

					y0: always.numeric(self.y0 + 7 * Math.sin(step / 10)),
					y1: always.numeric(self.y1 + 7 * Math.sin(step / 10))
				}
			}
		}
	}

	self.standing = self => {
		return (step, reflect = false) => {
			/*

			*/
			if (reflect) {
				return self
			} else {
				return {
					x0: always.numeric( self.x0 - (constants.dx * (step - self.init)) ) ,
					x1: always.numeric( self.x1 - (constants.dx * (step - self.init)) ) ,

					y0: always.numeric(self.y0) ,
					y1: always.numeric(self.y1)
				}
			}
		}
	}

	self.falling = self => {
		return (step, reflect = false) => {
			/*
				given an initial v→ generate a function giving
				the players position at a given step. This closed form
				makes it easier to raycast collisions.
			*/

			if (reflect) {
				return self
			} else {
				const time = step - self.init

				return {
					x0: always.numeric(self.x0 + self.vx * time + 0.5 * self.ax * (time * time)),
					x1: always.numeric(self.x1 + self.vx * time + 0.5 * self.ax * (time * time)),

					y0: always.numeric(self.y0 + self.vy * time + 0.5 * self.ay * (time * time)),
					y1: always.numeric(self.y1 + self.vy * time + 0.5 * self.ay * (time * time))
				}
			}
		}
	}

	self.cloud = self => {
		return (step, reflect = false) => {

			if (reflect) {
				return self
			} else {
				return {
					x0: always.numeric( constants.bounds.x1 - (constants.dx * (step - self.init)) ),
					x1: always.numeric( constants.bounds.x1 - (constants.dx * (step - self.init)) + constants.cloud.width ),

					y0: always.numeric(self.y0),
					y1: always.numeric(self.y1)

				}
			}
		}
	}

	return self

} )()


// the initial state

var state = ( function () {
	/*
		The initial game state. All fields that
		should be present are present from the start.
	*/

	var self = {}

	self.cloudTimer = function () {
		return true
	}

	self.clouds = []
	self.hero = {
		position: motion.flying({
			x0: 10,
			x1: 10 + constants.hero.width,

			y0: constants.cloudBounds.y0 + 50 ,
			y1: constants.cloudBounds.y0 + 50 + constants.hero.height,

			vx: constants.birdDx,
			vy: 0
		}),

		isDead:
			false,

		positionType:
			'flying',

		jumps: {

		}
	}

	// reactions are temporally ordered.
	self.reactions = []
	self.collisions = {}

	self.score = {
		value: 0,
		x0: constants.score.x0,
		y0: constants.score.y0
	}
	self.nextCloud = 0,
	self.step = 0

	return self

} )()



const react = ( function () {
	/*
		This module returns 'setters' for the game state. Each function
		herein takes a part of the game state, and modifies it. They don't usually
		test if the state should be modified - that task falls on update and currently.
	*/

	return {
		addClouds:
			state => {

				state.clouds = state.clouds.concat( ( function () {

					const init = state.step

					const y0 = utils.randBetween(
						0.150 * constants.bounds.y1 - constants.hero.height - 10,
						0.875 * constants.bounds.y1)

					const y1 = y0 + constants.cloud.height

					return {
						position: motion.cloud({
							init: always.whole(state.step),
							y0: always.numeric(y0),
							y1: always.numeric(y1)
						}),
						cloudId: always.whole(state.nextCloud)
					}

				} )() )

				state.cloudTimer = utils.timer(constants.cloudInterval)

				state.nextCloud = always.whole(state.nextCloud + 1)

				return state
			},
		removeOldClouds:
			state => {
				/*
					Remove the cloud functions that - at the current
					timestep - are offscreen.
				*/

				state.clouds = state.clouds.filter(function (cloud) {
					return always.boolean(cloud.position(state.step).x0 > constants.bounds.x0)
				})

				return state
			},
		clipWings:
			state => {
				/*
					Swap the initial flying sin-wave motion function for a
					falling motion function.
				*/

				var hero = state.hero

				if (hero.positionType === "flying") {
					hero.positionType = 'falling'

					const coords = hero.position(state.step)

					const ySlope = ( function () {

						const coords1 = hero.position(state.step + constants.epsilon)

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

						init: state.step
					}) )
				}

				state.hero = hero

				return state
			},
		enqueueCollisions:
			state => {
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

				var hero = state.hero

				//if (hero.positionType !== 'falling') {
				//	return state
				//}

				utils.flatmap(state.clouds, function (cloud) {
					/*
						for each cloud check at what time
						the player shares its y position with the cloud.
					*/

					var comps = {
						ay:
							always.numeric(constants.gravity),
						vy:
							always.numeric(hero.position(0, true).vy),
						c:
							always.numeric(cloud.position(0).y0)
					}

					var t = utils.solve(comps.ay, comps.vy, comps.c)

					// sort out the solutions for t

					var future = {
						hero: hero.position(t),
						cloud: cloud.position(t)
					}

					var isAlignedX =
						future.hero.x1 > future.cloud.x0 &&
						future.hero.x0 < future.cloud.x1

					if (isAlignedX) {
						/*
							The hero lands on the cloud in the future.
							Return the collision details.
						*/

						return [{
							position: motion.standing({
								x0: future.hero.x0,
								x1: future.hero.x1,
								y0: future.hero.y0,
								y1: future.hero.y1
							}),
							step: t
						}]
					}



				})






				return state
			},
		alterCourse:
			state => {
				/*
					The pre-calculated collision point has
					been reached, so we need to swap out
					the current player's motion function for
					the pre-computed motion function.
				*/

				const hero = state.player
				const collision = state.collisions[0]

				hero.position = collision.position

				state.collisions = []
				state.hero = hero

				return state
			},
		endGame:
			state => {
				/*
					The game is over.
				*/

				state.hero.isDead = true

				return state
			},
		beginJumpPowerup:
			time => {
				return state => {
					/*
						register that we are getting ready to jump.
					*/

					var hero = state.hero

					if (hero.positionType === 'standing' || hero.positionType === "falling") {
						hero.jumps = {
							'time': time
						}
					}
					state.hero = hero

					return state
				}
			},
		jump:
			function (x, y, time) {
				return state => {

					if (state.hero.positionType !== "standing") {
						return state
					}

					var magnitude = constants.asMagnitude(time - state.hero.jumps.time)
					var hero = state.hero

					var mouse = {
						x: always.numeric(x - canvas.offsetLeft),
						y: always.numeric(y - canvas.offsetTop)
					}

					var dist = {
						x: always.numeric(mouse.x - hero.x1),
						y: always.numeric(mouse.y - hero.y1)
					}

					var angle = Math.atan(dist.y / dist.x)

					var velocities = {
						x:
							constants.asVelocity( magnitude * Math.cos(angle) ),
						y:
							constants.asVelocity( magnitude * Math.sin(angle) )
					}

					hero.vx = velocities.x
					hero.vy = velocities.y

					hero.y0 = always.numeric(hero.y0 - 1)
					hero.y1 = always.numeric(hero.y1 - 1)

					hero.positionType = 'falling'
					hero.jumps = {}

					state.hero = hero

					return state
				}
			}
	}
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
				return true || always.numeric(state.collisions.length) === 0
			},
		cloudIsReady:
			state => {
				return state.cloudTimer()
			},
		offscren:
			state => {

				const coords = state.hero.position( state.step )

				const isOffscreen = coords.y1 > constants.bounds.y1 ||
					coords.x0 < constants.bounds.x0 ||
					coords.x1 > constants.bounds.x1

				return isOffscreen
			},
		flying:
			state => {
				return state.hero.positionType === 'flying'
			},
		falling:
			state => {
				return state.hero.positionType === 'falling'
			},
		notFalling:
			state => {
				return state.hero.positionType !== 'falling'
			},

		colliding:
			state => {
				return state.collisions.length > 0 &&
				state.collisions[0].step === state.step
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
		game state at state.step - returns the state at state.step + 1
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

		when(currently.offscren, react.endGame)

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
		state.step = always.whole(state.step + 1)

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

					var coords = cloud.position(state.step)

					ctx.fillRect(coords.x0, coords.y0, constants.cloud.width, constants.cloud.height)
				})
			},
		hero:
			state => {

				const hero = state.hero
				const birdy = document.getElementById("bird-asset")

				if (hero.jumps.time) {
					ctx.fillStyle = constants.colours.black
				} else {
					ctx.fillStyle = constants.colours.white
				}

				const coords = hero.position(state.step)

				ctx.drawImage(birdy, coords.x0, coords.y0)
			},
		score:
			state => {
				// draw the score to the corner of the screen.

				ctx.font = "30px Monospace"

				ctx.fillText(
					state.score.value + "",
					constants.score.x0, constants.score.y0)

			},
		deathScreen:
			state => {

				ctx.fillstyle = 'rgba(0,0,0,0.6)'

				ctx.fillRect(
					constants.bounds.x0, constants.bounds.y0,
					constants.bounds.x1, constants.bounds.y1)

				ctx.fillStyle = constants.colours.blue

				ctx.fillRect(
					constants.bounds.x0, 200,
					constants.bounds.x1, 100)

				ctx.font = "20px Monospace"

				ctx.fillStyle = constants.colours.white

				value = state.score.value

				ctx.fillText(
					"You ran out of cluck. " +
					"Score: " + state.score.value,
					constants.score.x0, 265)
			}
	}

	return state => {

		const when = (condition, reaction) => {
			// side-effectfully update state.

			if (condition(state)) {
				reaction(state)
			}
		}
		canvas.width = canvas.width

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

		if (state.hero.positionType === "flying") {
			return react.clipWings
		} else {
			return react.beginJumpPowerup(utils.getTime)
		}
	})

	upon('mouseup', event => {

		return react.jump(
			event.pageX,
			event.pageY,
			utils.getTime)
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
