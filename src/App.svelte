<script>
	import { onMount } from "svelte";
	// export let name;
	let inputRef = null;
	onMount(() => {
		inputRef.focus();
	});
</script>

<main class="section is-medium columns is-flex is-vcentered">
	<div class="container is-max-desktop has-text-centered">
		<h1 class="title" translate="no"><img src="/favicon.svg" alt="logo"> Readability</h1>
		<form action="/api/readability" method="get" class="search-form">
			<div class="field has-addons">
				<p class="control is-expanded">
					<input
						name="url"
						type="url"
						required
						placeholder='Link to an "unreadable" article'
						bind:this={inputRef}
						class="input is-rounded has-text-centered search-box"
					/>
				</p>
				<p class="control">
					<input
						type="submit"
						value="Read"
						class="button is-link is-outlined is-rounded search-button"
					/>
				</p>
			</div>
		</form>
		<p>
			<small>
				The 
				<a
					href="https://github.com/McFev/readability-bot-v2"
					target="_blank"
				>
				service
				</a>
				is powered by
				<a
					href="https://github.com/mozilla/readability"
					target="_blank"
				>
				Readability.js
				</a>
				and hosted on
				<a href="https://vercel.com/" target="_blank">Vercel</a>.
			</small>
		</p>
	</div>
</main>

<style>
	main {
		min-width: 100vw;
		min-height: 100vh;
		margin-top: -54px;
	}

	h1 {
		color: #CA4638;
		text-transform: uppercase;
		font-size: 2.5em;
		font-weight: bold;
	}

	h1 > img {
		height: 1cap;
	}

	.search-form .field {
		margin: 2rem 4rem;
	}

	@media (max-width: 768px) {
		.search-form .field {
			margin: 2rem 0rem;
		}
	}
</style>
